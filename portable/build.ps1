$source = "..\service\"
$destination = "portable.zip"

If(Test-path $destination) {Remove-item $destination}

Add-Type -assembly "system.io.compression.filesystem"
[io.compression.zipfile]::CreateFromDirectory($Source, $destination) 

$add = "run.bat", "installnode.ps1"

[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$zip = [System.IO.Compression.ZipFile]::Open($destination,"Update")
$add | foreach {
  $FileName = [System.IO.Path]::GetFileName($_)
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_,$FileName,"Optimal") | Out-Null
}

$Zip.Dispose()
