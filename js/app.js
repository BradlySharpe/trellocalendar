var user = new Object();
user.loadingTrello = true;
user.creatingCalendar = false;

var app = {
    initialize: function() {
        app.Log("Authenticating with Trello");
        app.UpdateButton("btnOptions", true)
        $(document).ajaxStop(function () {
            $("#status").html("<b>Status: </b> Complete")
            if (user.loadingTrello == true){
                user.loadingTrello = false;
                app.UpdateButton("btnOptions", false)
            }

            if (user.creatingCalendar == true){
                user.creatingCalendar = false;
                app.UpdateButton("btnRun", false)
            }
        });
        $("#status").html("<b>Status: </b> Authenticating with Trello")
        app.AuthenticateTrello();
    },
    AuthenticateTrello: function() {
    	var authOpts = [];
    	authOpts["type"] = "redirect";
    	authOpts["name"] = "Calendar View";
    	authOpts["persist"] = "true";
    	authOpts["interactive"] = "true";
    	authOpts["scope"] = {read:"allowRead", write:"allowWrite", account:"allowAccount"};
    	authOpts["expiration"] = "never";
    	authOpts["success"] = app.AuthSuccess;
    	authOpts["error"] = function(){ app.Failed("Denied Access") };
    	app.Log("Calling Trello Auth");
    	Trello.authorize(authOpts);
    },
    AuthSuccess: function() {
    	app.Log("Authenticated");
        app.Log("Getting User Data");
        $("#status").html("<b>Status: </b> Getting User Data")
        $( ".tabs" ).tabs();
        $( "#tabs" ).tabs( "disable" );
    	app.GerUserData();
    },
    Failed: function(msg) {
    	app.Log("Failure Occured: " + msg);
    },
    CheckforParams: function(){

    },
    GerUserData: function() {
        $( "#tabs" ).tabs( "enable" );
        $( "#tabs" ).tabs( "option", "disabled", [ 1, 2, 3 ] )
        app.CheckforParams();

        Trello.rest("GET", "members/me", {}, 
            function(data){
                user.id = data.id;
                user.username = data.username;
                user.fullname = data.fullName;
                user.email = data.email;
                user.url = data.url;
                user.status = data.status;
                user.avatar = data.avatarHash;
                user.boards = new Object();
                $("#status").html("<b>Status: </b> Fetching Board Information")
                $.each(data.idBoards, function (index, value){
                    user.boards[value] = new Object();
                    user.boards[value].id = value; 
                    app.GetBoardInformation(index, user.boards[value]);            
                });
            }, 
            function(){app.Failed("Couldn't return 'Me'")});
    },
    GetBoardInformation: function(index, board){
        app.UpdateFromBoard();
        if (board.id){
            Trello.rest("GET", "board/" + board.id, {}, 
                function(data){
                    user.boards[board.id].color = app.changeColour(index, data);
                    user.boards[board.id].textColor = app.getTextColor(user.boards[board.id].color)
                    if (data.idOrganization){
                        board.name = data.name;
                        board.url = data.shortUrl;
                        board.labels = new Object();
                        $.each(data.labelNames, function(index, value){
                            board.labels[index] = value;
                        });
                        $("#BoardsCheckboxes").prepend('<input type="checkbox" id="cb' + board.id + '" value="' + board.id + '" onclick="app.UpdateFromBoard(\'' + board.id + '\')" > ' + board.name +"<br />");  
                        app.GetBoardLists(board);
                    }
                }, 
                function(){
                    app.Failed("Couldn't get board " + board.id);
                }
            );
        }
    },
    GetBoardLists: function (board){
        if (board.id){
            Trello.rest("GET", "board/" + board.id + "/lists/all", {}, 
                function(data){
                    board.lists = new Object();
                    $.each(data, function(index, value){
                        board.lists[value.id] = value.name
                    })
                }, 
                function(){
                    app.Failed("Couldn't get board " + board.id);
                }
            );
        }
    },
    UpdateFromBoard: function(boardid){
        $("#ListsCheckboxes").empty();
        var boards = $("#BoardsCheckboxes input[type=checkbox]");
        app.UpdateButton("btnBoard", true);
        app.UpdateButton("btnList", true);
        app.UpdateButton("btnRun", true);
        var canProgress = false;
        var allSelected = true;
        var counter = 0;
        $.each(boards, function(index, cb){
            counter++;
            if (cb.checked == true){
                canProgress = true;
                if ((user.boards[cb.value]) && (user.boards[cb.value].lists)) {
                    $.each(user.boards[cb.value].lists, function (index, value){
                        $("#ListsCheckboxes").prepend('<input type="checkbox" id="cb' + index + '" value="' + index + '" onclick="app.UpdateFromList(\'' + index + '\')" > ' + user.boards[cb.value].name + " - " + value +"<br />");
                    });
                }
            } else {
                allSelected = false;
            }
        })
        app.UpdateButton("btnBoard", !canProgress);
        app.updateAllSelected("selectAllBoards", allSelected, counter);
    },
    UpdateFromList: function(listid){
        var lists = $("#ListsCheckboxes input[type=checkbox]");
        app.UpdateButton("btnList", true);
        app.UpdateButton("btnRun", true);
        var canProgress = false;
        var allSelected = true;
        var counter = 0;
        $.each(lists, function(index, cb){
            counter++;
            if (cb.checked == true){
                canProgress = true;
            } else {
                allSelected = false;
            }
        })
        app.UpdateButton("btnList", !canProgress);
        app.UpdateButton("btnRun", !canProgress);
        app.updateAllSelected("selectAllLists", allSelected, counter);
    },
    MoveTab: function (activateIndex, disableIndexs){
        $("#colorLegend").empty();
        $("#colors").hide("fast");
        $("#calendar").empty();
        $("#tabs").tabs("enable", activateIndex );
        $("#tabs").tabs("option", "active", activateIndex);
        $("#tabs").tabs("option", "disabled", disableIndexs );

        $("#tabs").tabs("option", "active", activateIndex);      
    },
    CreateCalendar: function(){
        user.creatingCalendar = true;
        app.UpdateButton("btnRun", true)
        $("#status").html("<b>Status: </b> Creating Calendar")
        $('#calendar').fullCalendar( 'destroy' )
        $( "#tabs" ).tabs( "option", "disabled", [ 0, 1, 2, 3 ] );
        app.Log("Creating Calendar");
        $("#colorLegend").empty();
        user.events = Array();
        
        $('#calendar').fullCalendar({
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'month,agendaWeek,agendaDay'
            },
            editable: true,
            events: user.events,
            eventClick: function(event) {
                if (event.url) {
                    app.openLink(event.url);
                    return false;
                }
            }
        });

        var boards = $("#BoardsCheckboxes input[type=checkbox]");
        $.each(boards, function(index, cb){
            $("#colorLegend").append("<button class=\"btn\" style=\"color:" + user.boards[cb.value].textColor + ";background-color:" + user.boards[cb.value].color + "\">" + user.boards[cb.value].name + "</button>");
            $("#colors").show("fast")
        });
        

        var lists = $("#ListsCheckboxes input[type=checkbox]");
        $.each(lists, function(index, cb){
            if (cb.checked == true){
                Trello.rest("GET", "lists/" + cb.value + "/cards", {}, 
                    function(data){
                        $.each(data, function(index, card){
                            if (app.shouldShowCard(card) == true){
                                app.AddCardToCalendar(card);
                            }
                        });
                    }, 
                    function(){
                        app.Failed("Couldn't cards from list " + cb.value);
                    }
                );
            }
        })
    },
    shouldShowCard: function (card){
        var show = true;
        if ($("#assignedToMe")[0].checked == true){
            var assignedToMe = false;
            $.each(card.idMembers, function(index, value){
                if (value == user.id){
                    assignedToMe = true;
                }
            });
            show = assignedToMe;
        }
        return show;
    },
    AddCardToCalendar: function (card){
        if (card.due){
            var dueDate = app.getDueDate(card.due)
            user.events.push({
                id : card.id,
                title:card.name, 
                start:dueDate, 
                end:dueDate, 
                url:card.shortUrl,
                className: "calendarEvent",
                color: user.boards[card.idBoard].color,
                textColor: user.boards[card.idBoard].textColor,
                allDay: false
            })
            $('#calendar').fullCalendar('refetchEvents')
        }
    },
    UpdateButton: function(elementId, disabled){
        if (disabled == true){
            $("#" + elementId).attr('disabled','disabled');
            $("#" + elementId).removeClass('btnGreen');
        } else {
            $("#" + elementId).removeAttr('disabled');
            $("#" + elementId).addClass('btnGreen');
        }
    },
    selectAllBoards: function() {
        var cbSelect = $("#selectAllBoards")[0];
        var selectedValue = cbSelect.checked;
        var boards = $("#BoardsCheckboxes input[type=checkbox]");
        $.each(boards, function(index, cb){
            cb.checked = selectedValue;
        })
        app.UpdateFromBoard();
    },
    selectAllLists: function() {
        var cbSelect = $("#selectAllLists")[0];
        var selectedValue = cbSelect.checked;
        var lists = $("#ListsCheckboxes input[type=checkbox]");
        $.each(lists, function(index, cb){
            cb.checked = selectedValue;
        })
        app.UpdateFromList();
    },
    updateAllSelected: function (selector, checkedValue, counter){
        $("#" + selector)[0].checked = ((checkedValue==true) && (counter > 0));
    },
    getDueDate: function (due){
        dueDate = new Date(due);
        return dueDate;
    },
    getDisplayDueDate: function (due){
        var dateObj = new Date(due);
        var dispDate = dateObj.getHours(); 
        var ampm = "";
        if (dateObj.getMinutes() < 10) {
            dispDate = dispDate + ":0" + dateObj.getMinutes();
        } else {
            dispDate = dispDate + ":" + dateObj.getMinutes();
        }

        if (dateObj.getHours() > 11) {
            ampm = "PM"
            dateObj.setHours(dateObj.getHours() - 12)
        } else {
            ampm = "AM"
        }

        if (dateObj.getSeconds() < 10) {
            dispDate = dispDate + ":0" + dateObj.getSeconds();
        } else {
            dispDate = dispDate + ":" + dateObj.getSeconds();
        }
        return dispDate + " " + ampm + " - ";
    },
    convertDateTime: function(dateStr){
        var dateObj = new Date(dateStr);
        dateObj.setMonth(dateObj.getMonth() + 1);
        return dateObj
    },
    Log: function(msg) {
        console.log(msg);
    },
    changeColour: function(count, board){
        if (board.prefs.backgroundColor != "#205C7E") {
            RGB = app.HextoRGB(board.prefs.backgroundColor)
            return app.RGB(RGB.r, RGB.g, RGB.b)
        } else {
            var freqr = 1.666 * count;
            var freqg = 2.666 * count;
            var freqb = 3.666 * count;
            return app.makeColorGradient(freqr, freqg, freqb, 0, 0, 0, 128, 127);
        }
    },
    getTextColor: function(backgroundColor){
        var rgb = backgroundColor.replace(/^rgba?\(|\s+|\)$/g,'').split(',');
        return app.idealTextColor(rgb[0], rgb[1], rgb[2])
    },
    RGB: function (r,g,b)
    {
        return 'rgb(' + Math.floor(r) + ',' + Math.floor(g) + ',' + Math.floor(b) + ')';
    },
    makeColorGradient: function (frequency1, frequency2, frequency3, phase1, phase2, phase3, center, width, len)
    {
        if (len == undefined)      len = 50;
        if (center == undefined)   center = 128;
        if (width == undefined)    width = 127;

        var red = Math.sin(frequency1 + phase1) * width + center;
        var grn = Math.sin(frequency2 + phase2) * width + center;
        var blu = Math.sin(frequency3 + phase3) * width + center;
        return app.RGB(red,grn,blu);
    },
    idealTextColor: function(r,g,b) {
       //var nThreshold = 105;
       var nThreshold = 105;
       var components = app.getRGBComponents(r,g,b);
       var bgDelta = (components.R * 0.299) + (components.G * 0.587) + (components.B * 0.114);
       var val = 255 - bgDelta;
       return (val < nThreshold) ? "rgb(0,0,0)" : "rgb(255,255,255)" ;   
       //return ((val > 65 || val <50) && (val < 105)) ? "rgb(0,0,0)" : "rgb(255,255,255)" ;   
    },
    getRGBComponents: function(r,g,b) {       
        return {
           /*
           R: parseInt(r, 16),
           G: parseInt(g, 16),
           B: parseInt(b, 16)
           */
           R: r,
           G: g,
           B: b
        };
    },
    HextoRGB: function (hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    openLink: function (url){
        window.open(url);
    }
};