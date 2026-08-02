$cssPath = 'E:\проекты пеепе шнейне втфаааа\Нексо\Нексо\frontend\src\index.css'
$newRules = @"

.bubble-sent-glow {
  box-shadow:
    0 2px 12px rgba(33, 130, 255, 0.15),
    0 4px 20px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.bubble-sent-glow:hover {
  box-shadow:
    0 4px 20px rgba(33, 130, 255, 0.25),
    0 8px 32px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
.bubble-received-glow {
  box-shadow:
    0 2px 12px rgba(139, 92, 246, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.bubble-received-glow:hover {
  box-shadow:
    0 4px 20px rgba(139, 92, 246, 0.18),
    0 6px 24px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
"@
$content = Get-Content $cssPath -Encoding UTF8 -Raw
$content += $newRules
Set-Content $cssPath -Value $content -Encoding UTF8 -NoNewline
Write-Host "CSS updated: bubble glow classes added"
