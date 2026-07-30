# Setup AI-Proxy secrets using wrangler
# Run this script once to configure secrets for production

$secrets = @{
    "SECRET" = (Read-Host -Prompt "Enter AI Proxy Secret" -AsSecureString)
    "CEREBRAS_KEY_1" = (Read-Host -Prompt "Enter Cerebras API Key 1" -AsSecureString)
    "CEREBRAS_KEY_2" = (Read-Host -Prompt "Enter Cerebras API Key 2 (optional)" -AsSecureString)
    "CEREBRAS_KEY_3" = (Read-Host -Prompt "Enter Cerebras API Key 3 (optional)" -AsSecureString)
    "CEREBRAS_KEY_4" = (Read-Host -Prompt "Enter Cerebras API Key 4 (optional)" -AsSecureString)
    "GROQ_KEY_1" = (Read-Host -Prompt "Enter Groq API Key 1" -AsSecureString)
    "GROQ_KEY_2" = (Read-Host -Prompt "Enter Groq API Key 2 (optional)" -AsSecureString)
    "SAMBANOVA_KEY_1" = (Read-Host -Prompt "Enter Sambanova API Key 1" -AsSecureString)
    "MISTRAL_KEY_1" = (Read-Host -Prompt "Enter Mistral API Key 1 (optional)" -AsSecureString)
    "OPENROUTER_KEY_1" = (Read-Host -Prompt "Enter OpenRouter API Key 1 (optional)" -AsSecureString)
    "FAL_KEY_1" = (Read-Host -Prompt "Enter Fal.ai API Key 1 (optional)" -AsSecureString)
}

$ErrorActionPreference = "Continue"

foreach ($key in $secrets.Keys) {
    $value = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secrets[$key])
    )
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "[SKIP] $key — empty, not setting"
        continue
    }
    Write-Host "[SET] $key..."
    npx wrangler secret put $key --name nexo-ai-proxy --env production | Out-Null
    if ($?) {
        Write-Host "[OK] $key set successfully"
    } else {
        Write-Host "[FAIL] $key failed to set"
    }
}

Write-Host "`nAll secrets configured. Deploy with: npx wrangler deploy"