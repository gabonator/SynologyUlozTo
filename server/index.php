<?
  header("Access-Control-Allow-Origin: *");   
  header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
  header('Access-Control-Allow-Headers: X-Requested-With, content-type');

  if ($_SERVER['REQUEST_METHOD']=='OPTIONS') 
  {
    die();
  }
 
  if ($_SERVER["QUERY_STRING"] == "test")
  {
    ini_set('display_errors', 1);
    require "search.php";

    class Plugin
    {
      public function addResult($title, $download, $size, $datetime, $page, $hash, $seeds, $leechs, $category)
      {
        echo "Adding: title=".$title. " download=".$download." size=".$size." date=".$datetime." page=".$page." hash=".$hash." leechs=".$leechs." seeds=".$seeds." cat=".$category."<br>";
      }
    };

    $plugin = new Plugin();

    $curl = curl_init();

    $t = new SynoDLMSearchUlozto();
    $t->prepare($curl, "top");

    $response = curl_exec($curl);
    echo("result:".$t->parse($plugin, $response));
    $status = curl_getinfo($curl,CURLINFO_HTTP_CODE); 
    echo(" status: ".$status);
    curl_close($curl); 

    die();
  }

  if ($_SERVER['QUERY_STRING'] == "" )
  {
    readfile("data/".getLast(0));
    readfile("data/".getLast(-1));
    readfile("data/".getLast(-2));
    readfile("data/".getLast(-3));
    readfile("data/".getLast(-4));
    readfile("data/".getLast(-5));
    readfile("data/".getLast(-6));
    die();
  }

  function safe($txt)
  {
    $aux = "";
    $disallowed = "<>{}\"\r\n";
    for ($i = 0; $i < strlen($txt); $i++)
    {
      if (strpos($disallowed, $txt[$i]) === false)
        $aux .= $txt[$i];
    }
    return $aux;
  }

  $args = "";
  $keywords = array("url", "release", "csfdRating", "csfdTitle", "imdbRating", "imdbTitle", "imdbUrl", "csfdUrl");
  foreach ($keywords as $keyword)
  {
    if (isset($_GET[$keyword]))
    {
      if ($args != "")
        $args .= ", ";
      $args .= "\"".$keyword."\":\"".safe($_GET[$keyword])."\"";
    }
  }

  $record = "add({\"time\":\"".getTs()."\", \"ip\":\"".$_SERVER["REMOTE_ADDR"]."\", \"args\":{".$args."}});\n";
  $f = fopen("data/".getCurrent(), "a");
  fwrite($f, $record);
  fclose($f);

  die();

  function getCurrent()
  {
    return date("Y-m-d").".txt";
  }
  function getLast($days)
  {
    return date("Y-m-d", strtotime($days." days")).".txt";
  }
  function getTs()
  {
    return date("Y-m-d H:i:s");
  }
?>