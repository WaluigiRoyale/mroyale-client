var LOBBY_MUSIC_URL = ASSETS_URL + "audio/music/lobby.mp3";
var MENU_MUSIC_URL = ASSETS_URL + "audio/music/menu.mp3";
var SKINCOUNT = 1;
var SKIN_MUSIC_URL = {};
var TILE_ANIMATION = {};
var OBJ_ANIMATION = {};
var assetData = resources["https://raw.githubusercontent.com/mroyale/assets/master/assets/" + "assets.json"];
(function() {
    if (assetData.skins.count != undefined)
        SKINCOUNT=assetData.skins.count;
    for (i in assetData.skins.properties) {
        var prop = assetData.skins.properties;
        var music = prop[i].music;
        if (music != undefined)
            SKIN_MUSIC_URL[prop[i].id] = music;
    }
    if (assetData.tileAnim) {
        for (var anim of assetData.tileAnim) {
            var obj = {};
            obj.tiles = anim.tiles;
            obj.delay = anim.delay;
            obj.tilesets = anim.tilesets || [];
            TILE_ANIMATION[anim.startTile] = obj;
        }
    }
    if (assetData.objAnim) {
        for (var anim of assetData.objAnim) {
            var obj = {};
            obj.tiles = anim.tiles;
            obj.delay = anim.delay;
            obj.tilesets = anim.tilesets || [];
            OBJ_ANIMATION[anim.startTile] = obj;
        }
    }
})();