<?php
class SynoDLMSearchUlozto
{
  private $searchUrl = "http://ulozto.cz/hledej?password=unsecured&q=";
  private $communityUrl = "http://api.gabo.guru/ulozto/";
  private $blowfish;
  private $community;

  public function __construct() 
  {
    include "blowfish.php";
    $this->blowfish = new Blowfish();
  }

  public function prepare($curl, $query) 
  {
    $headers = array
    (
      "X-Requested-With: XMLHttpRequest"
    );  
    curl_setopt($curl, CURLOPT_HTTPHEADER, $headers); 
    if ($query == "top")
    {
      $this->community = true;
      curl_setopt($curl, CURLOPT_URL, $this->communityUrl);
    }
    else
      curl_setopt($curl, CURLOPT_URL, $this->searchUrl.urlencode($query));
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);                
  }

  public function parse($plugin, $response) 
  {
    if ($this->community)
    {
      return $this->parseCommunity($plugin, $response);
    }

    $response = str_replace("\n", "", $response);
    $response = str_replace("\\", "", $response);
      
    $regex_key = "kn\\[\"(.*?)\"\\]";
    $regex_data = "var kn = (\\{.*?\\})";
      
    preg_match("/".$regex_key."/", $response, $matches);
    $key = $matches[1];

    preg_match("/".$regex_data."/", $response, $matches);
    $raw_data = $matches[1];
      
    $jsondata = json_decode($raw_data);
    $data = array();
    foreach ($jsondata as $key=>$value)
      $data[$key] = $value;
      
    $this->blowfish->init($data[$key]);
    $skipFirst = true;
    $entries = 0;

    foreach ($data as $row)
    {
      if ( $skipFirst )
      {
        $skipFirst = false;
        continue;
      }
        
      $contents = self::trim($this->blowfish->decrypt($row));
      if (strpos($contents, "title") !== false)
      {
        $this->pushEntry($plugin, $contents);
        $entries++;
      }
    }

    return $entries;
  }

  public function parseCommunity($plugin, $response) 
  {
    $lines = explode("\r", implode("\r", explode("\n", $response)));

    foreach ($lines as $line)
    {
      $json = self::match($line, "\"args\":({.*?})");
      $element = json_decode($json, true);

      if ($element == null)
        continue;

      if (!isset($element["url"]))
        continue;

      $rawTitle = $element["rawTitle"];
      $name = $element["csfdTitle"];
      $download = $element["url"];
      $year = $element["release"];
      $seeds = $element["csfdRating"];
      $leechs = $element["imdbRating"];
      $about = $element["csfdUrl"];
      $hash = md5($download);

      if (!isset($year) || $year == "")
        $year = date("Y");

      if (!isset($name) || $name == "")
        $name = $rawTitle;

      if (!isset($name) || $name == "")
        $name = str_replace("-", " ", basename($download));

      if (!isset($about) || $about == "")
        $about = $download;

      $type = $seeds > 0 ? "Video" : "";

      $plugin->addResult($name, $download, 0, $year."-04-01", $about, $hash, $seeds, $leechs, $type);
    } 
  }
 
  private function match($txt, $regex)
  {
    preg_match("/".$regex."/", $txt, $matches);

    if ( count($matches) == 2 )
      return $matches[1];

    array_shift($matches);
    return $matches;
  }

  private function pushEntry($plugin, $data)
  {
    $data = str_replace("\n", "", $data);
    $data = str_replace("\t", "", $data);

    $url = self::match($data, "class=\"name\".*?href=\"(.*?)\"");
    $img = "<img src=\"https:".self::match($data, "class=\"img.*?src=\"(.*?)\"")."\">";
    $rating = self::match($data, "<abbr title=\"Hodno.*?\">(.*?)<\\/abbr>");
    $name = self::match($data, "title=\"(.*?)\"");
    $size = self::match($data, "<span>Velikost<\\/span>(.*?) (B|MB|GB|kB)<\\/li>");
    $time = self::match($data, "<span>.?as<\\/span>(.*?)<\\/li>");
      
    $size = self::calculateSize($size[0], $size[1]);

    $hash = md5($url);
    $seeds = $rating*10+100; // 100 -> 0 votes, 110 -> 1 vote, 90 -> -1 vote
    $leechs = 0;

    $year = self::match($name, ".*\\b((19|20)\\d{2})\\b");
    $year = count($year) == 2 ? $year[0] : date("Y");

    $download = "http://ulozto.cz".$url;

    if ( is_null($image) || is_array($image) )
      $image = "";

    if ( is_null($time) || is_array($time) )
      $time = "";

    if ( is_null($rating) || is_array($rating) )
      $rating = "";

    $about = "http://ulozto.cz".$url."?g_rating=".$rating."&g_img=".str_replace("http://", "", $image)."&g_time=".$time;

    $category = self::getCategoryByName($name);
    $plugin->addResult($name, $download, $size, $year."-04-01", $about, $hash, $seeds, $leechs, $category);
  }

  private function calculateSize($number, $units)
  {
    $number = floatval($number);
    $mul = 1.0;
    if ( $units == "kB" )
      $mul = 1024.0;
    if ( $units == "MB" )
      $mul = 1024.0*1024.0;
    if ( $units == "GB" )
      $mul = 1024.0*1024.0*1024.0;

    $aux = floor($number * $mul);

    return $aux;
  }

  private function trim($str)
  {
    while ( strlen($str) > 0 && ord(substr($str, strlen($str)-1, 1)) == 0 )
      $str = substr($str, 0, strlen($str)-1);
      
    return $str;
  }

  private function getCategoryByName($name)
  {
    $fileTypes = array(
      ".torrent" 	=> "Torrent",

      ".rar" 			=> "Compressed archive",
      ".zip" 			=> "Compressed archive",
      ".7z" 			=> "Compressed archive",
      

      ".pdf" 			=> "Document",
      ".txt" 			=> "Document",

      ".srt"			=> "Subtitles",

      ".avi"			=> "Video",
      ".mpg"			=> "Video",
      ".mkv"			=> "Video",
      ".mp4"			=> "Video",
      ".wmv"			=> "Video",
      ".mov"			=> "Video",
      ".vob"			=> "Video",

      ".mp3"			=> "Audio",
      ".flac"			=> "Audio",
      ".wav"			=> "Audio",
    
      ".gif"			=> "Image",
      ".jpg"			=> "Image",
      ".jpeg"			=> "Image",

      ".apk"			=> "Android application",

      ".iso"			=> "ISO Image"
    );

    foreach ($fileTypes as $ext => $fileType) 
    {
      if ( strstr($name, $ext) !== false )
        return $fileType;
    }

    return "Unknown category";
  }
}
?>