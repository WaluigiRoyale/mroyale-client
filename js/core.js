const ASSETS_URL = "https://raw.githubusercontent.com/mroyale/assets/master/";
(function($) {
    var pagify = {
        items: {},
        container: {},
        totalPages: {},
        perPage: {},
        currentPage: {},
        navigator: {},
        pageNavigator: {},
        createNavigation: function(id) {
            this.totalPages[id] = Math.ceil(this.items[id].length / this.perPage[id]);

            $('#'+id+"-pagination", this.container[id].parent()).remove();
            var pagination = $('<div class="pagination"></div>').append('<a class="nav prev disabled" data-next="false"><</a>');

            for (var i = 0; i < this.totalPages[id]; i++) {
                var pageElClass = "page";
                if (!i)
                    pageElClass = "page current";
                var pageEl = '<a class="' + pageElClass + '" data-page="' + (
                i + 1) + '">' + (
                i + 1) + "</a>";
                pagination.append(pageEl);
            }
            pagination.append('<a class="nav next" data-next="true">></a>');
            var pgId = id+"-pagination";
            pagination.attr("id", pgId);
            this.container[id].after(pagination);

            var that = this;
            $("#"+pgId).off("click", ".nav");
            this.navigator[id] = $("#"+pgId).on("click", ".nav", function() {
                var el = $(this);
                that.navigate(id, el.data("next"));
            });

            $("#"+pgId).off("click", ".page");
            this.pageNavigator[id] = $("#"+pgId).on("click", ".page", function() {
                var el = $(this);
                that.goToPage(id, el.data("page"));
            });
        },
        navigate: function(id, next) {
            // default perPage[id] to 5
            if (isNaN(next) || next === undefined) {
                next = true;
            }
            var pgId = id+"-pagination";
            $("#"+pgId+" > .nav").removeClass("disabled");
            if (next) {
                this.currentPage[id]++;
                if (this.currentPage[id] > (this.totalPages[id] - 1))
                    this.currentPage[id] = (this.totalPages[id] - 1);
                if (this.currentPage[id] == (this.totalPages[id] - 1))
                    $("#"+pgId+" > .nav.next").addClass("disabled");
                }
            else {
                this.currentPage[id]--;
                if (this.currentPage[id] < 0)
                    this.currentPage[id] = 0;
                if (this.currentPage[id] == 0)
                    $("#"+pgId+" > .nav.prev").addClass("disabled");
                }

            this.showItems(id);
        },
        updateNavigation: function(id) {

            var pgId = id+"-pagination";
            var pages = $("#"+pgId+" > .page");
            pages.removeClass("current");
            $("#"+pgId+" > .page[data-page=\"" + (
            this.currentPage[id] + 1) + '"]').addClass("current");
        },
        goToPage: function(id, page) {

            var pgId = id+"-pagination";
            this.currentPage[id] = page - 1;

            $("#"+pgId+" > .nav").removeClass("disabled");
            if (this.currentPage[id] == (this.totalPages[id] - 1))
                $("#"+pgId+" > .nav.next").addClass("disabled");

            if (this.currentPage[id] == 0)
                $("#"+pgId+" > .nav.prev").addClass("disabled");
            this.showItems(id);
        },
        showItems: function(id) {
            this.items[id].hide();
            var base = this.perPage[id] * this.currentPage[id];
            this.items[id].slice(base, base + this.perPage[id]).show();

            this.updateNavigation(id);
        },
        init: function(container, items, perPage) {
            var id = container.attr("id");
            gg = this;
            this.container[id] = container;
            this.currentPage[id] = 0;
            this.totalPages[id] = 1;
            this.perPage[id] = perPage;
            this.items[id] = items;
            this.createNavigation(id);
            this.showItems(id);
        }
    };

    // stuff it all into a jQuery method!
    $.fn.pagify = function(perPage, itemSelector) {
        var el = $(this);
        var items = $(itemSelector, el);

        // default perPage to 5
        if (isNaN(perPage) || perPage === undefined) {
            perPage = 3;
        }

        // don't fire if fewer items than perPage
        if (items.length <= perPage) {
            return true;
        }

        pagify.init(el, items, perPage);
    };
})(jQuery);

function print(text) {
    var elem = document.createElement("p");
    elem.innerText = text;
    elem.setAttribute("class", "debugLog");
    document.getElementById("log").appendChild(elem);
}

var VERSION = (function() {
    var scripts = document.getElementsByTagName('script');
    var index = scripts.length - 1;
    var myScript = scripts[index];
    return myScript.src.split("?v=").slice(-1)[0];
})();

var jsons = [ASSETS_URL + "assets.json"]
var scripts = ["js/server.js", "js/url.js", "js/game.js"]
var resources = {}

function loadNext() {
    if (jsons.length) {
        var next = jsons.shift();
        //print("Loading "+next.split("/").pop()+" started");
        $.ajax({
            type: "GET",
            url: next + '?v=' + VERSION, 
            success: function(result) {
                resources[next] = result;
                //print("Loading "+next.split("/").pop()+" finished");
                loadNext();
            },
            dataType: "json",
            cache: true
        });
        return;
    }
    if (scripts.length == 0) return;
    var next = scripts.shift();
    //print("loading "+next.split("/").pop()+" started");
    $.ajax({
        type: "GET",
        url: next + '?v=' + VERSION, 
        success: function() {
            loadNext();
        },
        dataType: "script",
        cache: true
    });
}
loadNext();
