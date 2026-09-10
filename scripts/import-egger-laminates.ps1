$ErrorActionPreference = 'Stop'
$codes = @('W1000_9','W1100_9','U104_9','U201_9','U702_9','U708_9','U727_9','U732_9','U750_9','U960_9','U963_9','U599_9','U636_9','H1145_10','H1330_12','H1714_19','H3730_10','W1000_HG','U999_HG','W1000_PG','U999_PG','H1180_37','H1181_37','H3309_28')
$records = @()
foreach ($code in $codes) {
  $source = "https://www.egger.com/en/furniture-interior-design/decors/${code}?country=GB"
  try { $html = (Invoke-WebRequest $source -UseBasicParsing).Content } catch { Write-Output "SKIP unavailable $code"; continue }
  $title = [System.Net.WebUtility]::HtmlDecode([regex]::Match($html, '<title>(.*?)</title>').Groups[1].Value)
  $scale = [regex]::Match($html, 'approx\.\s*(\d+)\s*x\s*(\d+)\s*mm')
  if (!$scale.Success -or !$title.StartsWith($code.Split('_')[0])) { throw "Missing decor evidence: $code ($title)" }
  $before = $html.Substring(0, $scale.Index)
  $images = [regex]::Matches($before, 'src="(https://cdn\.egger\.com/img/pim/[^" ]+/original\.png)"')
  if ($images.Count -eq 0) { throw "No measured swatch: $code" }
  $asset = $images[$images.Count - 1].Groups[1].Value
  $check = Invoke-WebRequest $asset -Method Head -UseBasicParsing
  if ($check.StatusCode -ne 200) { throw "Swatch unavailable: $code" }
  $records += [ordered]@{code=$code; title=$title; sourceUrl=$source; swatchUrl=$asset; widthMm=[int]$scale.Groups[1].Value; heightMm=[int]$scale.Groups[2].Value}
  Write-Output "VERIFIED $title | $asset"
}
$target = Join-Path $PSScriptRoot '../packages/material-core/src/egger-source.json'
[IO.File]::WriteAllText($target, (ConvertTo-Json -InputObject $records -Depth 5))
