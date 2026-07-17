[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
  [string]$Method,

  [Parameter(Mandatory = $true)]
  [string]$Path,

  [Parameter()]
  [AllowNull()]
  [object]$Body,

  [Parameter()]
  [string]$ApiUrl = $env:PAPERCLIP_API_URL,

  [Parameter()]
  [string]$ApiKey = $env:PAPERCLIP_API_KEY,

  [Parameter()]
  [string]$RunId = $env:PAPERCLIP_RUN_ID
)

$absoluteUri = $null
if ([System.Uri]::TryCreate($Path, [System.UriKind]::Absolute, [ref]$absoluteUri)) {
  $requestUri = $absoluteUri.AbsoluteUri
}
else {
  if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    throw "PAPERCLIP_API_URL or -ApiUrl is required when -Path is relative."
  }

  $requestUri = "{0}/{1}" -f $ApiUrl.TrimEnd("/"), $Path.TrimStart("/")
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  throw "PAPERCLIP_API_KEY or -ApiKey is required."
}

$headers = @{
  Authorization = "Bearer $ApiKey"
}

if (-not [string]::IsNullOrWhiteSpace($RunId)) {
  $headers["X-Paperclip-Run-Id"] = $RunId
}

$requestParameters = @{
  Uri = $requestUri
  Method = $Method
  Headers = $headers
  ErrorAction = "Stop"
}

if ($PSBoundParameters.ContainsKey("Body")) {
  if ($Body -is [string]) {
    $json = $Body
  }
  else {
    $json = $Body | ConvertTo-Json -Depth 100 -Compress
  }

  $utf8 = [System.Text.UTF8Encoding]::new($false)
  $requestParameters["Body"] = $utf8.GetBytes($json)
  $requestParameters["ContentType"] = "application/json; charset=utf-8"
}

Invoke-RestMethod @requestParameters
