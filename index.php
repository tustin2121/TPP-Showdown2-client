<!DOCTYPE html>
<!--
           .............
       ,...................
     ,..................========
    ....~=##############=======+
   ...##################=======.
  ..=######+...,    +##=======,..
  ..=###### ., .....  +=====+,....
     ###########~,..  ======
  .....##############~=====+....., pokemonshowdown.com
  ..........###########====......
    ............#######,==......
  =###.,........+#####+ .......
  ####################~......,
  #################+======,
     ++++++++++++ =======+

Viewing source? We're open source! Check us out on GitHub!
https://github.com/Zarel/Pokemon-Showdown
https://github.com/Zarel/Pokemon-Showdown-Client (you are here)

Also visit us in the Dev chatroom:
https://psim.us/dev

-->
<meta charset="UTF-8" />
<meta id="viewport" name="viewport" content="width=device-width" />
<title>Showdown!</title>
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<link rel="shortcut icon" href="/lotid.png" id="dynamic-favicon" />
<link rel="stylesheet" href="/style/battle.css?" />
<link rel="stylesheet" href="/style/client.css?" />
<link rel="stylesheet" href="/sprites/digimon/digimon.css?" />
<link rel="stylesheet" href="/style/sim-types.css?" />
<link rel="stylesheet" href="/style/utilichart.css?" />
<link rel="stylesheet" href="/style/font-awesome.css?" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="manifest" href="/manifest.json" />
<script>var Config = {};</script>
<!--[if lte IE 8]><script>document.location.replace('http://pokemonshowdown.com/autodownload/win');</script><![endif]-->

<div id="header" class="header">
	<img class="logo" src="/pokemonshowdownbeta.png" srcset="/pokemonshowdownbeta@2x.png 2x" alt="Pok&eacute;mon Showdown! (beta)" width="146" height="44" /><div class="maintabbarbottom"></div>
</div>
<div class="ps-room scrollable" id="mainmenu"><div class="mainmenuwrapper">
	<div class="leftmenu">
		<div class="activitymenu">
			<div class="pmbox">
				<div class="pm-window news-embed" data-newsid="<!-- newsid -->">
					<h3><button class="closebutton" tabindex="-1"><i class="fa fa-times-circle"></i></button><button class="minimizebutton" tabindex="-1"><i class="fa fa-minus-circle"></i></button>News</h3>
					<div class="pm-log" style="max-height:none">
						<!-- news -->
					</div>
				</div>
			</div>
		</div>
		<div class="mainmenu">
			<div id="loading-message" class="mainmessage">Initializing... <noscript>FAILED<br /><br />Pok&eacute;mon Showdown requires JavaScript.</noscript></div>
		</div>
	</div>
	<div class="rightmenu">
	</div>
	<div class="mainmenufooter">
		<!-- <div class="bgcredit"></div> -->
		<small><a href="https://www.reddit.com/r/TPPLeague" target="_blank"><strong>TPPLeague</strong></a><br/>
		<a href="//dex.pokemonshowdown.com/" target="_blank">Pok&eacute;dex</a> | <a href="https://tppleague.me/replay/" target="_blank">Replays</a> | <small><a href="https://www.reddit.com/r/TPPLeague" target="_blank">Subreddit</a></small>
	</div>
</div></div>
<script>
	var LM = document.getElementById('loading-message');
	LM.innerHTML += ' DONE<br />Loading libraries...';
</script>
<script src="/js/lib/jquery-2.1.4.min.js"></script>
<script src="/js/lib/jquery-cookie.js"></script>
<script src="/js/lib/autoresize.jquery.min.js?"></script>
<!-- <script src="/js/lib/soundmanager2-nodebug-jsmin.js?"></script> -->
<script src="/js/webAudioManager.js"></script>
<script src="/audio/bgm-index.js"></script>
<script>
	soundManager.setup({url: '/swf/'});
</script>
<script src="/js/lib/html-css-sanitizer-minified.js?"></script>
<script src="/js/lib/lodash.core.js?"></script>
<script src="/js/lib/backbone.js?"></script>
<script src="/js/lib/d3.v3.min.js"></script>

<script>
	LM.innerHTML += ' DONE<br />Loading data...';
</script>

<script src="/config/config.js?"></script>
<script src="/js/battledata.js?"></script>
<script src="/js/storage.js?"></script>
<script src="/data/pokedex-mini.js?"></script>
<script src="/data/typechart.js?"></script>
<script src="/js/battle.js?"></script>
<script src="/js/lib/sockjs-1.4.0-nwjsfix.min.js"></script>
<script src="/js/lib/color-thief.min.js"></script>

<script>
	LM.innerHTML += ' DONE<br />Loading client...';
</script>

<script src="/js/client.js?"></script>
<script src="/js/client-topbar.js?"></script>
<script src="/js/client-mainmenu.js?"></script>
<script src="/js/client-teambuilder.js?"></script>
<script src="/js/client-ladder.js?"></script>
<script src="/js/client-chat.js?"></script>
<script src="/js/client-chat-tournament.js?"></script>
<script src="/js/battle-tooltips.js?"></script>
<script src="/js/client-battle.js?"></script>
<script src="/js/client-rooms.js?"></script>
<script src="/data/graphics.js?"></script>
<script src="/sprites/bgs/bg-index.js"></script>
<script src="/emotes/emoteregex.js"></script>
<script src="/badges/badge-anim.js"></script>

<script>
	var app = new App();
</script>

<script src="/data/pokedex.js?"></script>
<script src="/data/moves.js?"></script>
<script src="/data/items.js?"></script>
<script src="/data/abilities.js?"></script>
<script src="/data/tpp.js"></script>

<script src="/data/search-index.js?"></script>
<script src="/data/teambuilder-tables.js?"></script>
<script src="/js/search.js?"></script>

<script src="/data/aliases.js?" async="async"></script>
