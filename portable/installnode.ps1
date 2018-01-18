Add-Type -Assembly System.IO.Compression.FileSystem

function is64bit() 
{
    if ([IntPtr]::Size -eq 4) 
    { 
      return $false 
    }
    else 
    { 
      return $true 
    }
}

if (is64bit)
{
  $url = "https://nodejs.org/dist/v8.9.4/node-v8.9.4-win-x64.zip"
} else
{
  $url = "https://nodejs.org/dist/v8.9.4/node-v8.9.4-win-x86.zip"
}

$output = "$PSScriptRoot\archive.zip"
Invoke-WebRequest -Uri $url -OutFile $output

$zip = [IO.Compression.ZipFile]::OpenRead($output)
$entries=$zip.Entries | where {$_.FullName -like '*/node.exe'} 

#Write-Output $entries.Count

$entries | foreach {[IO.Compression.ZipFileExtensions]::ExtractToFile( $_, $PSScriptRoot + "\" + $_.Name) }

$zip.Dispose()

Remove-item $output
