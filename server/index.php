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
    echo("<html><head><meta http-equiv=\"Content-type\" content=\"text/html; charset=utf-8\"/></head><body>");

    ini_set('display_errors', 1);
    require "search.php";

    class Plugin
    {
      public function __construct() 
      {
        echo "<table border=1><thead><td>title</td><td>download</td><td>size</td><td>date</td><td>page</td><td>leechs</td><td>seeds</td><td>cat</td></thead>";
      }
      public function __destruct() 
      {
        echo "</table>";
      }

      public function addResult($title, $download, $size, $datetime, $page, $hash, $seeds, $leechs, $category)
      {
        echo "<tr><td>".$title."</td><td>".$download."</td><td>".$size."</td><td>".$datetime."</td><td>".$page."</td><td>".$leechs."</td><td>".$seeds."</td><td>".$category."</td></tr>";
      }
    };

    $plugin = new Plugin();

    $curl = curl_init();

    $t = new SynoDLMSearchUlozto();
    $t->prepare($curl, "top");

    $response = curl_exec($curl);
    $t->parse($plugin, $response);
    $status = curl_getinfo($curl,CURLINFO_HTTP_CODE); 
    curl_close($curl); 
    unset($plugin);

    echo("</body></html>");
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
    for ($i = 0; $i < min(100, strlen($txt)); $i++)
    {
      if (strpos($disallowed, $txt[$i]) === false)
        $aux .= $txt[$i];
    }
    return $aux;
  }

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
  
  $args = "";
  $keywords = array("url", "release", "csfdRating", "csfdTitle", "imdbRating", "imdbTitle", "imdbUrl", "csfdUrl", "rawTitle",
    "user_path", "user_os", "user_host");

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
?>