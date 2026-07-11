import { useState, useRef } from 'react';
import { Upload, X, Loader2, Crown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function PremiumBadgeUpload() {
  const { user, updateUser } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(user?.premiumBadgeUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Можно загружать только изображения');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5 МБ');
      return;
    }

    try {
      setUploading(true);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      // Upload
      const formData = new FormData();
      formData.append('badge', file);

      const updated = await api.post('/premium-badge', formData);
      updateUser({ premiumBadgeUrl: updated.premiumBadgeUrl });
      
      alert('Значок обновлён!');
    } catch (e) {
      console.error('Failed to upload badge:', e);
      alert('Ошибка загрузки значка');
      setPreview(user?.premiumBadgeUrl || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!confirm('Удалить значок?')) return;

    try {
      setUploading(true);
      await api.delete('/premium-badge');
      updateUser({ premiumBadgeUrl: null });
      setPreview(null);
      alert('Значок удалён');
    } catch (e) {
      console.error('Failed to remove badge:', e);
      alert('Ошибка удаления значка');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={16} className="text-yellow-400" />
        <h4 className="text-sm font-semibold text-white">Премиум значок</h4>
      </div>
      
      <p className="text-xs text-zinc-400 mb-3">
        Загрузите изображение или GIF, которое будет отображаться после вашего имени
      </p>

      <div className="flex items-center gap-3">
        {/* Preview */}
        {preview && (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-tertiary border border-white/10">
            <img
              src={preview}
              alt="Badge preview"
              className="w-full h-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload size={16} />
              {preview ? 'Изменить' : 'Загрузить'}
            </>
          )}
        </button>

        {/* Remove button */}
        {preview && !uploading && (
          <button
            onClick={handleRemove}
            className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-600 mt-2">
        Поддерживаются: PNG, JPG, GIF (макс. 5 МБ)
      </p>
    </div>
  );
}
