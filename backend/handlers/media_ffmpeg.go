package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"nexo/logging"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"nexo/models"
)

// ─── FFmpeg availability ────────────────────────────────────────────────────
// The binary is resolved once (env FFMPEG_PATH, otherwise PATH lookup) and
// cached. ProcessMedia degrades gracefully when ffmpeg is missing: the
// original file is always kept, only derived artifacts are skipped.

var (
	ffmpegOnce    sync.Once
	ffmpegPath    string
	ffmpegFound   bool
	ffprobeOnce   sync.Once
	ffprobePath   string
	ffprobeFound  bool
)

func ffmpegBinary() string {
	ffmpegOnce.Do(func() {
		if p := os.Getenv("FFMPEG_PATH"); p != "" {
			ffmpegPath, ffmpegFound = p, true
			return
		}
		if p, err := exec.LookPath("ffmpeg"); err == nil {
			ffmpegPath, ffmpegFound = p, true
		}
	})
	return ffmpegPath
}

func ffprobeBinary() string {
	ffprobeOnce.Do(func() {
		if p := os.Getenv("FFPROBE_PATH"); p != "" {
			ffprobePath, ffprobeFound = p, true
			return
		}
		if p, err := exec.LookPath("ffprobe"); err == nil {
			ffprobePath, ffprobeFound = p, true
		}
	})
	return ffprobePath
}

// isFFmpegAvailable reports whether the ffmpeg binary is usable. Cached via sync.Once.
func isFFmpegAvailable() bool {
	return ffmpegBinary() != ""
}

func runFFmpeg(ctx context.Context, args ...string) error {
	bin := ffmpegBinary()
	if bin == "" {
		return fmt.Errorf("ffmpeg not available")
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = append(os.Environ(), "FFREPORT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg %v failed: %v (output: %.300s)", args, err, out)
	}
	return nil
}

const mediaProcessTimeout = 30 * time.Second

// ProcessMedia derives thumbnails and alternate formats for uploaded images
// and videos using ffmpeg. It never destroys the original file and never
// returns an error that should fail the upload — callers must treat the
// error as non-fatal (original file remains the served URL).
func ProcessMedia(filePath, id string, media *models.Media) error {
	if media == nil {
		return fmt.Errorf("media is nil")
	}
	if !isFFmpegAvailable() {
		return fmt.Errorf("ffmpeg not available")
	}

	ctx, cancel := context.WithTimeout(context.Background(), mediaProcessTimeout)
	defer cancel()

	switch media.Type {
	case "image":
		return processImage(ctx, filePath, id, media)
	case "video":
		return processVideo(ctx, filePath, id, media)
	default:
		// Audio and plain files: no processing.
		return nil
	}
}

// scaleFilter returns an ffmpeg scale filter that caps the larger side at maxPx.
func scaleFilter(maxPx int) string {
	return fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", maxPx, maxPx)
}

func cleanupArtifacts(id string, paths ...string) {
	for _, p := range paths {
		if p == "" {
			continue
		}
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			logging.Log.Warn("[MEDIA] cleanup failed for path", "path", p, "err", err)
		}
	}
}

func processImage(ctx context.Context, filePath, id string, media *models.Media) error {
	dir := filepath.Dir(filePath)
	thumbPath := filepath.Join(dir, id+"_thumb.jpg")
	webpPath := filepath.Join(dir, id+"_webp.webp")
	avifPath := filepath.Join(dir, id+"_avif.avif")

	thumbURL := "/uploads/" + id + "_thumb.jpg"
	webpURL := "/uploads/" + id + "_webp.webp"
	avifURL := "/uploads/" + id + "_avif.avif"

	// Thumbnail: JPEG q~80, max 480px on the larger side, first frame.
	thumbArgs := []string{
		"-y", "-i", filePath,
		"-vf", scaleFilter(480),
		"-frames:v", "1",
		"-q:v", "2",
		"-f", "image2",
		thumbPath,
	}
	if err := runFFmpeg(ctx, thumbArgs...); err != nil {
		logging.Log.Warn("[MEDIA] thumbnail generation failed", "media_id", id, "err", err)
		return err
	}
	media.Thumbnail = thumbURL

	formats := map[string]string{
		"original":  media.URL,
		"thumbnail": thumbURL,
	}

	// WebP (for animated GIFs only the first frame is taken).
	webpArgs := []string{
		"-y", "-i", filePath,
		"-vf", scaleFilter(1280),
		"-frames:v", "1",
		"-c:v", "libwebp",
		"-quality", "80",
		webpPath,
	}
	if err := runFFmpeg(ctx, webpArgs...); err != nil {
		logging.Log.Warn("[MEDIA] webp conversion failed", "media_id", id, "err", err)
	} else {
		formats["webp"] = webpURL
	}

	// AVIF (still-picture for photos).
	avifArgs := []string{
		"-y", "-i", filePath,
		"-vf", scaleFilter(1280),
		"-frames:v", "1",
		"-c:v", "libaom-av1",
		"-crf", "30",
		"-b:v", "0",
		"-still-picture", "1",
		avifPath,
	}
	if err := runFFmpeg(ctx, avifArgs...); err != nil {
		logging.Log.Warn("[MEDIA] avif conversion failed", "media_id", id, "err", err)
	} else {
		formats["avif"] = avifURL
	}

	media.Formats = formats
	return nil
}

func processVideo(ctx context.Context, filePath, id string, media *models.Media) error {
	dir := filepath.Dir(filePath)

	// Thumbnail from the frame at ~1s (fast seek: -ss before -i).
	thumbPath := filepath.Join(dir, id+"_thumb.jpg")
	thumbArgs := []string{
		"-y", "-ss", "1", "-i", filePath,
		"-frames:v", "1",
		"-vf", scaleFilter(480),
		"-q:v", "2",
		"-f", "image2",
		thumbPath,
	}
	if err := runFFmpeg(ctx, thumbArgs...); err != nil {
		logging.Log.Warn("[MEDIA] video thumbnail failed", "media_id", id, "err", err)
	} else {
		media.Thumbnail = "/uploads/" + id + "_thumb.jpg"
	}

	// Duration via ffprobe (optional — skipped when ffprobe is missing).
	if p := ffprobeBinary(); p != "" {
		if d, err := probeDuration(ctx, p, filePath); err == nil && d > 0 {
			media.Duration = d
		} else if err != nil {
			logging.Log.Warn("[MEDIA] ffprobe duration failed", "media_id", id, "err", err)
		}
	}

	// Re-encode only when it actually helps: the file is not MP4 yet, or it is
	// large enough that a compact H.264 copy makes sense.
	srcExt := strings.ToLower(filepath.Ext(media.URL))
	size := media.Size
	needsTranscode := srcExt != ".mp4" || size > 2*1024*1024
	if !needsTranscode {
		return nil
	}

	transcodedPath := filepath.Join(dir, id+"_transcoded.mp4")
	transArgs := []string{
		"-y", "-i", filePath,
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "23",
		"-c:a", "aac",
		"-b:a", "128k",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		transcodedPath,
	}
	if err := runFFmpeg(ctx, transArgs...); err != nil {
		logging.Log.Warn("[MEDIA] transcode failed", "media_id", id, "err", err)
		cleanupArtifacts(id, thumbPath)
		return err
	}

	info, err := os.Stat(transcodedPath)
	if err != nil || info.Size() == 0 {
		logging.Log.Warn("[MEDIA] transcode produced no output", "media_id", id, "err", err)
		cleanupArtifacts(id, thumbPath, transcodedPath)
		return fmt.Errorf("transcode produced no output")
	}

	// The transcoded MP4 becomes the served media; keep the source format
	// recorded in OriginalFormat so clients can tell the file was converted.
	origURL := media.URL
	media.OriginalFormat = srcExt
	media.URL = "/uploads/" + id + "_transcoded.mp4"
	media.Size = int(info.Size())
	media.Formats = map[string]string{
		"original": origURL,
	}
	return nil
}

func probeDuration(ctx context.Context, probeBin, filePath string) (float64, error) {
	cmd := exec.CommandContext(ctx, probeBin,
		"-v", "quiet", "-print_format", "json", "-show_format", filePath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return 0, err
	}
	var info struct {
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &info); err != nil {
		return 0, err
	}
	d, err := strconv.ParseFloat(info.Format.Duration, 64)
	if err != nil {
		return 0, err
	}
	return d, nil
}
