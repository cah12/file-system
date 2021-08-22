
'use strict';
/*
 *contextMenu.js v 1.4.1
 *Author: Sudhanshu Yadav
 *s-yadav.github.com
 *Copyright (c) 2013-2015 Sudhanshu Yadav.
 *Dual licensed under the MIT and GPL licenses
 */
;
(function ($, window, document, undefined) {
  "use strict";

  $.single = (function () {
    var single = $({});
    return function (elm) {
      single[0] = elm;
      return single;
    };
  }());

  $.fn.contextMenu = function (method, selector, option) {

    //parameter fix
    if (!methods[method]) {
      option = selector;
      selector = method;
      method = 'popup';
    }
    //need to check for array object
    else if (selector) {
      if (!((selector instanceof Array) || (typeof selector === 'string') || (selector.nodeType) || (selector.jquery))) {
        option = selector;
        selector = null;
      }
    }

    if ((selector instanceof Array) && (method != 'update')) {
      method = 'menu';
    }

    var myoptions = option;
    if ($.inArray(method, ['menu', 'popup', 'close', 'destroy']) > -1) {
      option = iMethods.optionOtimizer(method, option);
      this.each(function () {
        var $this = $(this)
        myoptions = $.extend({}, $.fn.contextMenu.defaults, option);
        if (!myoptions.baseTrigger) {
          myoptions.baseTrigger = $this;
        }
        methods[method].call($this, selector, myoptions)
      });
    } else {
      methods[method].call(this, selector, myoptions)
    }
    return this;
  };
  $.fn.contextMenu.defaults = {
    triggerOn: 'click', //avaliable options are all event related mouse plus enter option
    subMenuTriggerOn: 'hover click',
    displayAround: 'cursor', // cursor or trigger
    mouseClick: 'left',
    verAdjust: 0,
    horAdjust: 0,
    top: 'auto',
    left: 'auto',
    closeOther: true, //to close other already opened context menu
    containment: window,
    winEventClose: true,
    position: 'auto', //allowed values are top, left, bottom and right
    closeOnClick: true, //close context menu on click/ trigger of any item in menu

    //callback
    onOpen: function (data, event) { },
    afterOpen: function (data, event) { },
    onClose: function (data, event) { }
  };

  var methods = {
    menu: function (selector, option) {
      selector = iMethods.createMenuList(this, selector, option);
      iMethods.contextMenuBind.call(this, selector, option, 'menu');
    },
    popup: function (selector, option) {
      $(selector).addClass('iw-contextMenu');
      iMethods.contextMenuBind.call(this, selector, option, 'popup');
    },
    update: function (selector, option) {
      var self = this;
      option = option || {};

      this.each(function () {
        var trgr = $(this),
          menuData = trgr.data('iw-menuData');
        //refresh if any new element is added
        if (!menuData) {
          self.contextMenu('refresh');
          menuData = trgr.data('iw-menuData');
        }

        var menu = menuData.menu;
        if (typeof selector === 'object') {

          for (var i = 0; i < selector.length; i++) {
            var name = selector[i].name,
              disable = selector[i].disable,
              fun = selector[i].fun,
              icon = selector[i].icon,
              img = selector[i].img,
              title = selector[i].title,
              className = selector[i].className,
              elm = menu.children('li').filter(function () {
                return $(this).contents().filter(function () {
                  return this.nodeType == 3;
                }).text() == name;
              }),
              subMenu = selector[i].subMenu;

            //toggle disable if provided on update method
            disable != undefined && (disable ? elm.addClass('iw-mDisable') : elm.removeClass('iw-mDisable'));

            //bind new function if provided
            fun && elm.unbind('click.contextMenu').bind('click.contextMenu', fun);

            //update title
            title != undefined && elm.attr('title', title);

            //update class name
            className != undefined && elm.attr('class', className);

            var imgIcon = elm.find('.iw-mIcon');
            if (imgIcon.length) imgIcon.remove();

            //update image or icon
            if (img) {
              elm.prepend('<img src="' + img + '" align="absmiddle" class="iw-mIcon" />');
            } else if (icon) {
              elm.prepend('<span align="absmiddle" class="iw-mIcon ' + icon + '" />');
            }

            //to change submenus
            if (subMenu) {
              elm.contextMenu('update', subMenu);
            }
          }
        }

        iMethods.onOff(menu);

        //bind event again if trigger option has changed.
        var triggerOn = option.triggerOn;
        if (triggerOn) {
          trgr.unbind('.contextMenu');

          //add contextMenu identifier on all events
          triggerOn = triggerOn.split(" ");
          var events = [];
          for (var i = 0, ln = triggerOn.length; i < ln; i++) {
            events.push(triggerOn[i] + '.contextMenu')
          }

          //to bind event
          trgr.bind(events.join(' '), iMethods.eventHandler);
        }

        //set menu data back to trigger element
        menuData.option = $.extend({}, menuData.option, option);
        trgr.data('iw-menuData', menuData);
      });
    },
    refresh: function () {
      var menuData = this.filter(function () {
        return !!$(this).data('iw-menuData');
      }).data('iw-menuData'),
        newElm = this.filter(function () {
          return !$(this).data('iw-menuData');
        });
      //to change basetrigger on refresh  
      menuData.option.baseTrigger = this;
      iMethods.contextMenuBind.call(newElm, menuData.menuSelector, menuData.option);
    },
    open: function (sel, data) {
      data = data || {};
      var e = data.event || $.Event('click');
      if (data.top) e.clientY = data.top;
      if (data.left) e.clientX = data.left;
      this.each(function () {
        iMethods.eventHandler.call(this, e);
      });
    },
    //to force context menu to close
    close: function () {
      var menuData = this.data('iw-menuData');
      if (menuData) {
        iMethods.closeContextMenu(menuData.option, this, menuData.menu, null);
      }
    },
    //to get value of a key
    value: function (key) {
      var menuData = this.data('iw-menuData');
      if (menuData[key]) {
        return menuData[key];
      } else if (menuData.option) {
        return menuData.option[key];
      }
      return null;
    },
    destroy: function () {
      var trgr = this,
        menuId = trgr.data('iw-menuData').menuId,
        menu = $('.iw-contextMenu[menuId=' + menuId + ']'),
        menuData = menu.data('iw-menuData');

      //Handle the situation of dynamically added element.
      if (!menuData) return;


      if (menuData.noTrigger == 1) {
        if (menu.hasClass('iw-created')) {
          menu.remove();
        } else {
          menu.removeClass('iw-contextMenu ' + menuId)
            .removeAttr('menuId').removeData('iw-menuData');
          //to destroy submenus
          menu.find('li.iw-mTrigger').contextMenu('destroy');
        }
      } else {
        menuData.noTrigger--;
        menu.data('iw-menuData', menuData);
      }
      trgr.unbind('.contextMenu').removeClass('iw-mTrigger').removeData('iw-menuData');
    }
  };
  var iMethods = {
    contextMenuBind: function (selector, option, method) {
      var trigger = this,
        menu = $(selector),
        menuData = menu.data('iw-menuData');

      //fallback
      if (menu.length == 0) {
        menu = trigger.find(selector);
        if (menu.length == 0) {
          return;
        }
      }

      if (method == 'menu') {
        iMethods.menuHover(menu);
      }
      //get base trigger
      var baseTrigger = option.baseTrigger;


      if (!menuData) {
        var menuId;
        if (!baseTrigger.data('iw-menuData')) {
          menuId = Math.ceil(Math.random() * 100000);
          baseTrigger.data('iw-menuData', {
            'menuId': menuId
          });
        } else {
          menuId = baseTrigger.data('iw-menuData').menuId;
        }
        //create clone menu to calculate exact height and width.
        var cloneMenu = menu.clone();
        cloneMenu.appendTo('body');

        menuData = {
          'menuId': menuId,
          'menuWidth': cloneMenu.outerWidth(true),
          'menuHeight': cloneMenu.outerHeight(true),
          'noTrigger': 1,
          'trigger': trigger
        };


        //to set data on selector
        menu.data('iw-menuData', menuData).attr('menuId', menuId);
        //remove clone menu
        cloneMenu.remove();
      } else {
        menuData.noTrigger++;
        menu.data('iw-menuData', menuData);
      }

      //to set data on trigger
      trigger.addClass('iw-mTrigger').data('iw-menuData', {
        'menuId': menuData.menuId,
        'option': option,
        'menu': menu,
        'menuSelector': selector,
        'method': method
      });

      //hover fix
      var triggerOn = option.triggerOn;
      if (triggerOn.indexOf('hover') != -1) {
        triggerOn = triggerOn.replace('hover', 'mouseenter');
        //hover out if display is of context menu is on hover
        if (baseTrigger.index(trigger) != -1) {
          baseTrigger.add(menu).bind('mouseleave.contextMenu', function (e) {
            if ($(e.relatedTarget).closest('.iw-contextMenu').length == 0) {
              $('.iw-contextMenu[menuId="' + menuData.menuId + '"]').fadeOut(100);
            }
          });
        }

      }

      trigger.delegate('input,a,.needs-click', 'click', function (e) {
        e.stopImmediatePropagation()
      });

      //add contextMenu identifier on all events
      triggerOn = triggerOn.split(' ');
      var events = [];
      for (var i = 0, ln = triggerOn.length; i < ln; i++) {
        events.push(triggerOn[i] + '.contextMenu')
      }

      //to bind event
      trigger.bind(events.join(' '), iMethods.eventHandler);

      //to stop bubbling in menu
      menu.bind('click mouseenter', function (e) {
        e.stopPropagation();
      });

      menu.delegate('li', 'click', function (e) {
        if (option.closeOnClick && !$.single(this).hasClass('iw-has-submenu')) iMethods.closeContextMenu(option, trigger, menu, e);
      });
    },
    eventHandler: function (e) {
      e.preventDefault();
      var trigger = $(this),
        trgrData = trigger.data('iw-menuData'),
        menu = trgrData.menu,
        menuData = menu.data('iw-menuData'),
        option = trgrData.option,
        cntnmnt = option.containment,
        clbckData = {
          trigger: trigger,
          menu: menu
        },
        //check conditions
        cntWin = cntnmnt == window,
        btChck = option.baseTrigger.index(trigger) == -1;

      //to close previous open menu.
      if (!btChck && option.closeOther) {
        $('.iw-contextMenu').css('display', 'none');
      }

      //to reset already selected menu item
      menu.find('.iw-mSelected').removeClass('iw-mSelected');

      //call open callback
      option.onOpen.call(this, clbckData, e);


      var cObj = $(cntnmnt),
        cHeight = cObj.innerHeight(),
        cWidth = cObj.innerWidth(),
        cTop = 0,
        cLeft = 0,
        menuHeight = menuData.menuHeight,
        menuWidth = menuData.menuWidth,
        va, ha,
        left = 0,
        top = 0,
        bottomMenu,
        rightMenu,
        verAdjust = va = parseInt(option.verAdjust),
        horAdjust = ha = parseInt(option.horAdjust);

      if (!cntWin) {
        cTop = cObj.offset().top;
        cLeft = cObj.offset().left;

        //to add relative position if no position is defined on containment
        if (cObj.css('position') == 'static') {
          cObj.css('position', 'relative');
        }

      }


      if (option.displayAround == 'cursor') {
        left = cntWin ? e.clientX : e.clientX + $(window).scrollLeft() - cLeft;
        top = cntWin ? e.clientY : e.clientY + $(window).scrollTop() - cTop;
        bottomMenu = top + menuHeight;
        rightMenu = left + menuWidth;
        //max height and width of context menu
        if (bottomMenu > cHeight) {
          if ((top - menuHeight) < 0) {
            if ((bottomMenu - cHeight) < (menuHeight - top)) {
              top = cHeight - menuHeight;
              va = -1 * va;
            } else {
              top = 0;
              va = 0;
            }
          } else {
            top = top - menuHeight;
            va = -1 * va;
          }
        }
        if (rightMenu > cWidth) {
          if ((left - menuWidth) < 0) {
            if ((rightMenu - cWidth) < (menuWidth - left)) {
              left = cWidth - menuWidth;
              ha = -1 * ha;
            } else {
              left = 0;
              ha = 0;
            }
          } else {
            left = left - menuWidth;
            ha = -1 * ha;
          }
        }
      } else if (option.displayAround == 'trigger') {
        var triggerHeight = trigger.outerHeight(true),
          triggerWidth = trigger.outerWidth(true),
          triggerLeft = cntWin ? trigger.offset().left - cObj.scrollLeft() : trigger.offset().left - cLeft,
          triggerTop = cntWin ? trigger.offset().top - cObj.scrollTop() : trigger.offset().top - cTop,
          leftShift = triggerWidth;

        left = triggerLeft + triggerWidth;
        top = triggerTop;


        bottomMenu = top + menuHeight;
        rightMenu = left + menuWidth;
        //max height and width of context menu
        if (bottomMenu > cHeight) {
          if ((top - menuHeight) < 0) {
            if ((bottomMenu - cHeight) < (menuHeight - top)) {
              top = cHeight - menuHeight;
              va = -1 * va;
            } else {
              top = 0;
              va = 0;
            }
          } else {
            top = top - menuHeight + triggerHeight;
            va = -1 * va;
          }
        }
        if (rightMenu > cWidth) {
          if ((left - menuWidth) < 0) {
            if ((rightMenu - cWidth) < (menuWidth - left)) {
              left = cWidth - menuWidth;
              ha = -1 * ha;
              leftShift = -triggerWidth;
            } else {
              left = 0;
              ha = 0;
              leftShift = 0;
            }
          } else {
            left = left - menuWidth - triggerWidth;
            ha = -1 * ha;
            leftShift = -triggerWidth;
          }
        }
        //test end
        if (option.position == 'top') {
          top = triggerTop - menuHeight;
          va = verAdjust;
          left = left - leftShift;
        } else if (option.position == 'left') {
          left = triggerLeft - menuWidth;
          ha = horAdjust;
        } else if (option.position == 'bottom') {
          top = triggerTop + triggerHeight;
          va = verAdjust;
          left = left - leftShift;
        } else if (option.position == 'right') {
          left = triggerLeft + triggerWidth;
          ha = horAdjust;
        }
      }

      //applying css property
      var cssObj = {
        'position': (cntWin || btChck) ? 'fixed' : 'absolute',
        'display': 'inline-block',
        'height': '',
        'width': ''
      };


      //to get position from offset parent
      if (option.left != 'auto') {
        left = iMethods.getPxSize(option.left, cWidth);
      }
      if (option.top != 'auto') {
        top = iMethods.getPxSize(option.top, cHeight);
      }
      if (!cntWin) {
        var oParPos = trigger.offsetParent().offset();
        if (btChck) {
          left = left + cLeft - $(window).scrollLeft();
          top = top + cTop - $(window).scrollTop();
        } else {
          left = left - (cLeft - oParPos.left);
          top = top - (cTop - oParPos.top);
        }
      }
      cssObj.left = left + ha + 'px';
      cssObj.top = top + va + 'px';

      menu.css(cssObj);

      //to call after open call back
      option.afterOpen.call(this, clbckData, e);


      //to add current menu class
      if (trigger.closest('.iw-contextMenu').length == 0) {
        $('.iw-curMenu').removeClass('iw-curMenu');
        menu.addClass('iw-curMenu');
      }


      var dataParm = {
        trigger: trigger,
        menu: menu,
        option: option,
        method: trgrData.method
      };
      $('html').unbind('click', iMethods.clickEvent).click(dataParm, iMethods.clickEvent);
      $(document).unbind('keydown', iMethods.keyEvent).keydown(dataParm, iMethods.keyEvent);
      if (option.winEventClose) {
        $(window).bind('scroll resize', dataParm, iMethods.scrollEvent);
      }
    },

    scrollEvent: function (e) {
      iMethods.closeContextMenu(e.data.option, e.data.trigger, e.data.menu, e);
    },

    clickEvent: function (e) {
      var button = e.data.trigger.get(0);

      if ((button !== e.target) && ($(e.target).closest('.iw-contextMenu').length == 0)) {
        iMethods.closeContextMenu(e.data.option, e.data.trigger, e.data.menu, e);
      }
    },
    keyEvent: function (e) {
      e.preventDefault();
      var menu = e.data.menu,
        option = e.data.option,
        keyCode = e.keyCode;
      // handle cursor keys
      if (keyCode == 27) {
        iMethods.closeContextMenu(option, e.data.trigger, menu, e);
      }
      if (e.data.method == 'menu') {
        var curMenu = $('.iw-curMenu'),
          optList = curMenu.children('li:not(.iw-mDisable)'),
          selected = optList.filter('.iw-mSelected'),
          index = optList.index(selected),
          focusOn = function (elm) {
            iMethods.selectMenu(curMenu, elm);
            var menuData = elm.data('iw-menuData');
            if (menuData) {
              iMethods.eventHandler.call(elm[0], e);

            }
          },
          first = function () {
            focusOn(optList.filter(':first'));
          },
          last = function () {
            focusOn(optList.filter(':last'));
          },
          next = function () {
            focusOn(optList.filter(':eq(' + (index + 1) + ')'));
          },
          prev = function () {
            focusOn(optList.filter(':eq(' + (index - 1) + ')'));
          },
          subMenu = function () {
            var menuData = selected.data('iw-menuData');
            if (menuData) {
              iMethods.eventHandler.call(selected[0], e);
              var selector = menuData.menu;
              selector.addClass('iw-curMenu');
              curMenu.removeClass('iw-curMenu');
              curMenu = selector;
              optList = curMenu.children('li:not(.iw-mDisable)');
              selected = optList.filter('.iw-mSelected');
              first();
            }
          },
          parMenu = function () {
            var selector = curMenu.data('iw-menuData').trigger;
            var parMenu = selector.closest('.iw-contextMenu');
            if (parMenu.length != 0) {
              curMenu.removeClass('iw-curMenu').css('display', 'none');
              parMenu.addClass('iw-curMenu');
            }
          };
        switch (keyCode) {
          case 13:
            selected.click();
            break;
          case 40:
            (index == optList.length - 1 || selected.length == 0) ? first() : next();
            break;
          case 38:
            (index == 0 || selected.length == 0) ? last() : prev();
            break;
          case 33:
            first();
            break;
          case 34:
            last();
            break;
          case 37:
            parMenu();
            break;
          case 39:
            subMenu();
            break;
        }
      }
    },
    closeContextMenu: function (option, trigger, menu, e) {

      //unbind all events from top DOM
      $(document).unbind('keydown', iMethods.keyEvent);
      $('html').unbind('click', iMethods.clickEvent);
      $(window).unbind('scroll resize', iMethods.scrollEvent);
      $('.iw-contextMenu').css('display', 'none');
      $(document).focus();

      //call close function
      option.onClose.call(this, {
        trigger: trigger,
        menu: menu
      }, e);
    },
    getPxSize: function (size, of) {
      if (!isNaN(size)) {
        return size;
      }
      if (size.indexOf('%') != -1) {
        return parseInt(size) * of / 100;
      } else {
        return parseInt(size);
      }
    },
    selectMenu: function (menu, elm) {
      //to select the list
      var selected = menu.find('li.iw-mSelected'),
        submenu = selected.find('.iw-contextMenu');
      if ((submenu.length != 0) && (selected[0] != elm[0])) {
        submenu.fadeOut(100);
      }
      selected.removeClass('iw-mSelected');
      elm.addClass('iw-mSelected');
    },
    menuHover: function (menu) {
      var lastEventTime = Date.now();
      menu.children('li').bind('mouseenter.contextMenu click.contextMenu', function (e) {
        //to make curmenu
        $('.iw-curMenu').removeClass('iw-curMenu');
        menu.addClass('iw-curMenu');
        iMethods.selectMenu(menu, $(this));
      });
    },
    createMenuList: function (trgr, selector, option) {
      var baseTrigger = option.baseTrigger,
        randomNum = Math.floor(Math.random() * 10000);
      if ((typeof selector == 'object') && (!selector.nodeType) && (!selector.jquery)) {
        var menuList = $('<ul class="iw-contextMenu iw-created iw-cm-menu" id="iw-contextMenu' + randomNum + '"></ul>');

        var z = option.zIndex || trgr.css("zIndex") //added               
        menuList.css("zIndex", z)//added
        //menuList.css("zIndex", trgr.css("zIndex"))//removed
        $.each(selector, function (index, selObj) {
          var name = selObj.name,
            fun = selObj.fun || function () { },
            subMenu = selObj.subMenu,
            img = selObj.img || '',
            icon = selObj.icon || '',
            title = selObj.title || "",
            className = selObj.className || "",
            disable = selObj.disable,
            list = $('<li title="' + title + '" class="' + className + '">' + name + '</li>');

          if (img) {
            list.prepend('<img src="' + img + '" align="absmiddle" class="iw-mIcon" />');
          } else if (icon) {
            list.prepend('<span align="absmiddle" class="' + "iw-mIcon " + icon + '" />');
          }
          //to add disable
          if (disable) {
            list.addClass('iw-mDisable');
          }

          if (!subMenu) {
            list.bind('click.contextMenu', function (e) {
              fun.call(this, {
                trigger: baseTrigger,
                menu: menuList
              }, e);
            });
          }

          //to create sub menu
          menuList.append(list);
          if (subMenu) {
            list.addClass('iw-has-submenu').append('<div class="iw-cm-arrow-right" />');
            iMethods.subMenu(list, subMenu, baseTrigger, option);
          }
        });

        if (baseTrigger.index(trgr[0]) == -1) {
          trgr.append(menuList);
        } else {
          var par = option.containment == window ? 'body' : option.containment;
          $(par).append(menuList);
        }

        iMethods.onOff($('#iw-contextMenu' + randomNum));
        return '#iw-contextMenu' + randomNum;
      } else if ($(selector).length != 0) {
        var element = $(selector);
        element.removeClass('iw-contextMenuCurrent')
          .addClass('iw-contextMenu iw-cm-menu iw-contextMenu' + randomNum)
          .attr('menuId', 'iw-contextMenu' + randomNum)
          .css('display', 'none');

        //to create subMenu
        element.find('ul').each(function (index, element) {
          var subMenu = $(this),
            parent = subMenu.parent('li');
          parent.append('<div class="iw-cm-arrow-right" />');
          subMenu.addClass('iw-contextMenuCurrent');
          iMethods.subMenu(parent, '.iw-contextMenuCurrent', baseTrigger, option);
        });
        iMethods.onOff($('.iw-contextMenu' + randomNum));
        return '.iw-contextMenu' + randomNum;
      }
    },
    subMenu: function (trigger, selector, baseTrigger, option) {
      trigger.contextMenu('menu', selector, {
        triggerOn: option.subMenuTriggerOn,
        displayAround: 'trigger',
        position: 'auto',
        mouseClick: 'left',
        baseTrigger: baseTrigger,
        containment: option.containment
      });
    },
    onOff: function (menu) {

      menu.find('.iw-mOverlay').remove();
      menu.find('.iw-mDisable').each(function () {
        var list = $(this);
        list.append('<div class="iw-mOverlay"/>');
        list.find('.iw-mOverlay').bind('click mouseenter', function (event) {
          event.stopPropagation();
        });

      });

    },
    optionOtimizer: function (method, option) {
      if (!option) {
        return;
      }
      if (method == 'menu') {
        if (!option.mouseClick) {
          option.mouseClick = 'right';
        }
      }
      if ((option.mouseClick == 'right') && (option.triggerOn == 'click')) {
        option.triggerOn = 'contextmenu';
      }

      if ($.inArray(option.triggerOn, ['hover', 'mouseenter', 'mouseover', 'mouseleave', 'mouseout', 'focusin', 'focusout']) != -1) {
        option.displayAround = 'trigger';
      }
      return option;
    }
  };
})(jQuery, window, document);


/* ********************************************************************************************************************** */
/* ******************************contextmenu end************************************************************************** */


/* 
isFile: 
displayName: 
parentPath: 
parentId: 
path: 
id: 
ext: 
sep: 
*/
class FileSystemServices {
  constructor(_options) {

    const self = this;
    //self.hasModifiedFile = false;
    //self.modifiedFiles = 0;
    let inMemoryToken = null;
    let options = _options || {};
    options.accessTokenExpiry = options.accessTokenExpiry || 10; //initialize with 10 secs if undefined
    const fsServerUrl = options.fsServerUrl || "http://localhost:3000";

    let currentFilename = null;

    this.currentFilename = function (filename) {
      if (filename !== undefined)
        currentFilename = filename;
      return currentFilename;
    }

    const listOfFileTypes = options.listOfFileTypes || [];
    const listOfOpenWithTypes = options.listOfOpenWithTypes || [];

    let imageLoaderSrc = "https://cdn.jsdelivr.net/gh/cah12/fs-mongo/img/imageLoader.png";
    let imageFolderSrc = "https://cdn.jsdelivr.net/gh/cah12/fs-mongo/img/folder.png";
    let imageFileSrc = "https://cdn.jsdelivr.net/gh/cah12/fs-mongo/img/file.png";

    if (options.imageLoaderSrc !== undefined) {
      if (options.imageLoaderSrc.length) {
        imageLoaderSrc = options.imageLoaderSrc;
      } else {
        imageLoaderSrc = null;
      }
    }

    if (options.imageFolderSrc !== undefined) {
      //console.log(444, options.imageFolderSrc)
      if (options.imageFolderSrc.length) {
        imageFolderSrc = options.imageFolderSrc;
      } else {
        imageFolderSrc = null;
      }
    }

    if (options.imageFileSrc !== undefined) {
      if (options.imageFileSrc.length) {
        imageFileSrc = options.imageFileSrc;
      } else {
        imageFileSrc = null;
      }
    }

    options.fsServerUrl = options.fsServerUrl || "";
    options.sameDomain = options.sameDomain === undefined ? true : options.sameDomain;

    options.persistSession = options.persistSession === undefined ? true : options.persistSession;

    /*  console.log(444, options.fsServerUrl)
     console.log(445, imageFolderSrc)
     console.log(446, imageFileSrc) */

    let editors = [];//holds objects {name: "Text Editor", editor: nodepad-obj}

    const chooseEditor = new ChooseEditor();

    this.registerEditor = function (editor) {
      editors.push(editor);
    }

    function getEditorByName(editorName) {
      const element = editors.find(element => element.name === editorName);
      if (element !== undefined) {
        return element.editor;
      }
      return null;
    }

    function getEditorByExt(ext) {
      for (let i = 0; i < editors.length; ++i) {
        const editor = editors[i].editor;
        const exts = editor.getExtensions();
        for (let n = 0; n < exts.length; ++n) {
          if (exts[n] == ext) {
            return editor;
          }
        }
      }
      return null;
    }

    let mongoFsLoginLogoutRegisterMenu = [
      {
        name: "Register",
        title: "Register for Mongo File System",
        fun: doRegister,
      },
      {
        name: "Login",
        title: "Login to Mongo File System",
        fun: doLogin
      },
    ];

    this.doExplorerDlg = async function () {
      if (!inMemoryToken) return alert("Not connected...");
      $("#dlgTitle").html("File Explorer");
      $("#inputFields").hide();
      $("#explorerSaveAsModal").modal();
      $("#saveAsType").val(".all");
      await init();
    };

    this.doSaveDlg = async function () {
      if (!inMemoryToken) return alert("Not connected...");
      $("#dlgTitle").html("Save As");
      $("#inputFields").show();
      $("#explorerSaveAsModal").modal();
      await init();
    };

    function doLogout() {
      self.disconnectFs((data) => {
        if (data.error) return console.log(data.msg);
        mongoFsLoginLogoutRegisterSeletor.contextMenu(mongoFsLoginLogoutRegisterMenu, { zIndex: 2000 });
        console.log(data.msg);
      });
    }

    function doNotepadDlg() {
      if (self.notepad)
        self.notepad.openEditor();
    }


    let mongoFsLoginLogoutRegisterMenu2 = [
      {
        name: "Logout",
        title: "Logout for Mongo File System",
        fun: doLogout,
      },
      {
        name: "Explorer",
        title: "Launch the Mongo File System explorer.",
        fun: self.doExplorerDlg
      }
    ];

    this.addMongoFsMenuItems = function (menuItems) {
      for (let i = 0; i < menuItems.length; ++i) {
        mongoFsLoginLogoutRegisterMenu2.push(menuItems[i]);
      }
    }

    this.addNotepadMenuItem = function () {
      mongoFsLoginLogoutRegisterMenu2.push({
        name: "Notepad",
        title: "Launch the Mongo File System notepad.",
        fun: doNotepadDlg
      })
    }

    this.addSaveMenuItem = function (editor) {
      mongoFsLoginLogoutRegisterMenu2.push({
        name: "Save",
        title: "Saves current document to Mongo File System.",
        fun: editor.save
      })
    }

    this.addSaveAsMenuItem = function (editor) {
      mongoFsLoginLogoutRegisterMenu2.push({
        name: "Save As",
        title: "Saves current document to Mongo File System.",
        fun: editor.saveAs
      })
    }

    var loginDlg = $(
      '<div id="registerLoginModal" class="modal fade" role="dialog"> <div class="modal-dialog"> <!-- Modal content--> <div class="modal-content"> <div class="modal-header"> <button type="button" class="close" data-dismiss="modal">&times;</button> <h4 style="color:rgb(51, 122, 183);" id="dlg-title" class="modal-title">Sign Up</h4> </div> <div class="modal-body"> <form id="registerLoginForm"> <div class="bottom-border"><span class="glyphicon glyphicon-user"></span><input id="dlg-username" name="username" class="no-outline" type="text" style="width: 97%; border-style: none;" placeholder="Enter Username"></div> <br> <div id="dlg-email-row"> <div class="bottom-border"><span class="glyphicon glyphicon-envelope"></span><input id="dlg-email" name="email" class="no-outline" type="email" style="width: 97%; border-style: none;" placeholder="Enter Email Address"></div> <br> </div> <div class="bottom-border"><span class="glyphicon glyphicon-lock"></span><input id="dlg-password"  name="password" class="no-outline" type="password" style="width: 97%; border-style: none;" placeholder="Enter Password"></div> <br> <div id="dlg-repeat-row"> <div class="bottom-border"><span class="glyphicon glyphicon-lock"></span><input id="dlg-repeat-password"  name="repeat_password" class="no-outline" type="password" style="width: 97%; border-style: none;" placeholder="Repeat Password"></div> </div> </form> </div> <div class="modal-footer"> <div><input type="button" id="dlg-cancel-button" class="btn btn-primary" value="Cancel" /> <input type="button" id="dlg-ok-button" class="btn btn-primary" value="Sig Up" /></div> </div> </div> </div> </div>'
    );
    $("body").append(loginDlg);

    var saveDlg = $(
      '<div id="explorerSaveAsModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog"> <!-- Modal content--> <div id="dlg-saveDlg" class="modal-content"> <div class="modal-header"><button id="saveDlgClose" type="button" class="close">&times;</button> <h4 id="dlgTitle" class="modal-title">Save As</h4> </div> <div class="modal-body"><br> <div class="container"></div> <div class="row"> <div class="col-sm-1"></div> <div class="col-sm-10"> <div class="row"> <div class="col-sm-2"> <label for="parent">Folder</label> </div> <div class="col-sm-7"> <input type="text" class="form-control inputClass" id="parent1" readonly> </div> <div class="col-sm-3"> <input type="button" class="form-control inputClass" id="configButton" value="Config"> </div> </div> <br> <div class="row"> <div class="col-sm-5"> <div style="overflow: scroll; height: 200px; border: solid; border-width: 1px;"> <table style="border-width: 0px; white-space: nowrap;" id="foldersTable"> <tbody></tbody> </table> </div> </div> <div id="menuElement" style="position: relative;" class="col-sm-7"> <div style="overflow: scroll; height: 200px; border: solid; border-width: 1px;"> <table style="border-width: 0px; white-space: nowrap;" id="filesTable"> <tbody></tbody> </table> </div> </div> </div><br> <div id="inputFields"> <div class="row"> <div class="col-sm-3"> <label for="name">File name</label> </div> <div class="col-sm-9"> <input type="text" class="form-control inputClass" id="name" name="name"> </div> </div> <br> <div class="row"> <div class="col-sm-3"> <label for="saveAsType">Save as type</label> </div> <div class="col-sm-9"> <select class="form-control inputClass" id="saveAsType"></select> </div> </div> <br> <button id="dlgSaveButton" style="width: 100%" class="btn btn-primary">Save</button> </div> </div> <div class="col-sm-1"></div> </div> </div> </div> </div> </div>'
    );
    $("body").append(saveDlg);

    var configDlg = $(
      '<div id="configModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog"> <!-- Modal content--> <div class="modal-content"> <div class="modal-header"><button type="button" class="close" data-dismiss="modal">&times;</button> <h4 id="dlg-title" style="text-align: center;" class="modal-title">Configuration</h4> </div> <div class="modal-body"><br> <div class="container"></div> <div class="row"> <div class="col-sm-1"></div> <div class="col-sm-10"> <div class="row"> <table class="config-table" style="width: 100%;"> <tr class="config-table"> <th class="config-table">Propery</th> <th class="config-table">Value</th> </tr> <tr class="config-table"> <td class="config-table">Root directory name</td> <td class="config-table"><input id="rootDir" type="text" style="width: 100%;" value="root:" /></td> </tr> <tr class="config-table"> <td class="config-table">Separator</td> <td class="config-table"><input id="sep" type="text" style="width: 100%;" value="" /></td> </tr> <tr class="config-table"> <td class="config-table">Dialog background color</td> <td class="config-table"><input id="dialog-background-color" type="color" value="#ffffff" /></td> </tr> <tr class="config-table"> <td class="config-table">Input background color</td> <td class="config-table"><input id="input-background-color" type="color" value="#ffffff" /></td> </tr> <tr class="config-table"> <td class="config-table">Store new files with GridFs</td> <td class="config-table"><input id="gridfs-storage" type="checkbox" checked /></td> </tr> </table> </div> <br> <div class="row"> <div class="col-sm-4"><input type="button" id="config-cancel-button" class="btn btn-primary" value="Cancel" style="width: 100%" ; /></div> <div class="col-sm-4"><input type="button" id="config-restore-button" class="btn btn-primary" value="Restore Defaults" style="width: 100%" ; /></div> <div class="col-sm-4"><input type="button" id="config-ok-button" class="btn btn-primary" value="Ok" style="width: 100%" ; /></div> </div> </div> </div> </div> </div> </div> </div>'
    );
    $("body").append(configDlg);

    saveDlg.append($('<div id="chooseEditorModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog"> <!-- Modal content--> <div class="modal-content"> <div class="modal-header"><button id="chooseEditorCancelX" type="button" class="close">&times;</button> <h4 id="dlg-title" style="text-align: center;" class="modal-title">How would you like to open this file?</h4> </div> <div class="modal-body"><br> <div class="container"></div> <div class="row"> <div class="col-sm-1"></div> <div class="col-sm-10"> <div class="row"> <form id="chooseEditorTable" style="width: 100%;"> </form> </div> <br> <div class="row"> <label><input id="alwaysUse" type="checkbox"><span id="alwaysUseLabel"></span></label> </div> <br> <div class="row"> <div class="col-sm-6"><input type="button" id="chooseEditorCancel" class="btn btn-primary" value="Cancel" style="width: 100%" ; /></div> <div class="col-sm-6"><input type="button" id="chooseEditorOk" class="btn btn-primary" value="Ok" style="width: 100%" ; /></div> </div> </div> </div> </div> </div> </div> </div>'));

    
    /* var chooseEditorDlg = $(
      '<div id="chooseEditorModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog"> <!-- Modal content--> <div class="modal-content"> <div class="modal-header"><button type="button" class="close" data-dismiss="modal">&times;</button> <h4 id="dlg-title" style="text-align: center;" class="modal-title">How would you like to open this file?</h4> </div> <div class="modal-body"><br> <div class="container"></div> <div class="row"> <div class="col-sm-1"></div> <div class="col-sm-10"> <div class="row"> <table class="config-table" style="width: 100%;"> <tr class="config-table"> <th class="config-table">Propery</th> <th class="config-table">Value</th> </tr> <tr class="config-table"> <td class="config-table">Root directory name</td> <td class="config-table"><input id="rootDir" type="text" style="width: 100%;" value="root:" /></td> </tr> <tr class="config-table"> <td class="config-table">Separator</td> <td class="config-table"><input id="sep" type="text" style="width: 100%;" value="" /></td> </tr> <tr class="config-table"> <td class="config-table">Dialog background color</td> <td class="config-table"><input id="dialog-background-color" type="color" value="#ffffff" /></td> </tr> <tr class="config-table"> <td class="config-table">Input background color</td> <td class="config-table"><input id="input-background-color" type="color" value="#ffffff" /></td> </tr> <tr class="config-table"> <td class="config-table">Store new files with GridFs</td> <td class="config-table"><input id="gridfs-storage" type="checkbox" checked /></td> </tr> </table> </div> <br> <div class="row"> <div class="col-sm-4"><input type="button" id="config-cancel-button" class="btn btn-primary" value="Cancel" style="width: 100%" ; /></div> <div class="col-sm-4"><input type="button" id="config-restore-button" class="btn btn-primary" value="Restore Defaults" style="width: 100%" ; /></div> <div class="col-sm-4"><input type="button" id="config-ok-button" class="btn btn-primary" value="Ok" style="width: 100%" ; /></div> </div> </div> </div> </div> </div> </div> </div>'
    );
    $("body").append(chooseEditorDlg); */

    if (imageLoaderSrc)
      saveDlg.append(
        $(
          '<img id="imageLoader" class="loader" style= "position: absolute;" src=' + imageLoaderSrc + '>'
        )
      );

    var configData = null;

    $("#chooseEditorCancel, #chooseEditorCancelX").click(function(){
      $("#chooseEditorModal").modal("hide");
    });

    $("#config-restore-button").click(() => {
      configData.dialogBackgroundColor = "#ffffff";
      configData.inputBackgroundColor = "#ffffff";
      configData.rootDir = "root:";
      configData.sep = "\\";
      configData.gridFsStorage = true;
      $("#rootDir").val(configData.rootDir);
      $("#sep").val(configData.sep);
      $("#dialog-background-color").val(configData.dialogBackgroundColor);
      $("#input-background-color").val(configData.inputBackgroundColor);
      //console.log(123, $("#gridfs-storage").prop("checked"))
      $("#gridfs-storage").prop("checked", configData.gridFsStorage);
      //console.log(124, $("#gridfs-storage").prop("checked"))
    });

    var prevW = parseInt(saveDlg.css("width"));
    var prevH = parseInt(saveDlg.css("height"));

    if (imageLoaderSrc) {
      $("#imageLoader").css("left", prevW / 2 - 15);
      $("#imageLoader").css("top", prevH / 2 - 15);

      $(window).on("resize", () => {
        var w = parseInt(saveDlg.css("width"));
        if (w !== prevW) {
          $("#imageLoader").css("left", 0.5 * w - 15);
        }
        var h = parseInt(saveDlg.css("height"));
        if (h !== prevH) {
          $("#imageLoader").css("top", 0.5 * h - 15);
        }
      });
      $("#imageLoader").hide();
      //$("#imageLoader").css("zIndex", 20);
    }



    const m_fsServerUrl = fsServerUrl;
    var name = "root";
    var parentName = "";
    var currentRowSelector = null;
    var currentSelectedRowSelector = null;
    var nodes = null;
    var filesTableRowSelected = false;
    var filesTableFileSelected = false;
    var selectedName = null;
    var editing = false;
    var rigthClickOnSelectedRow = false;

    var fileExtensions = [];

    $("body").on("contextmenu", function (e) {
      e.preventDefault();
    });

    $("#saveDlgClose").click(function () {
      $("#explorerSaveAsModal").attr("editorName", null);
      saveDlg.modal("hide");
    })

    String.prototype.spliceStr = function (idx, rem, str) {
      return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
    };

    let timer = null;
    function stopCountDown() {
      clearTimeout(timer);
    }

    function refresh(cb) {
      const refreshToken = self.getRefreshToken()
      if (!options.sameDomain && !refreshToken) return;

      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/refresh_token",
        data: JSON.stringify({ refreshToken }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",

        success: function (data) {
          inMemoryToken = data.accessToken;
          if (!options.sameDomain) {
            self.storeRefreshToken(data.refreshToken);
          }
          clearTimeout(timer);
          countDown();
          cb && cb(false, data)
        },
        error: function (data) {
          self.clearRefreshToken();//remove any invalid token
          cb && cb(true, data); //error         
        },
      });
    }
    //Set options.sameDomain to false to use getRefreshToken() even in same domain
    function countDown() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        refresh();
      }, (options.accessTokenExpiry - 0.5) * 1000)
    }

    //Renames a file or folder
    function renameNode(/* _data */) {
      const currentName = currentSelectedRowSelector.attr(
        "data-tt-displayName"
      );
      var _data = {};
      if (currentSelectedRowSelector.attr("data-tt-file") === "file") {
        _data.name = currentSelectedRowSelector.attr("data-tt-path");
      } else {
        _data.name = currentSelectedRowSelector.attr("data-tt-id");
      }
      var input = $('<input type="text"/>');
      input.val(currentName); //init text input
      var td = $(currentSelectedRowSelector.children()[0]);
      var innerTdHtml = td.html();
      var indexOfDisplayName = innerTdHtml.length - currentName.length;
      const n = innerTdHtml.indexOf(currentName);
      td.html(
        innerTdHtml.spliceStr(indexOfDisplayName, currentName.length, "")
      );
      td.append(input);
      input[0].focus();
      currentSelectedRowSelector.toggleClass("selected");
      editing = true;
      input.on("keyup", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) {
          input.remove();
          editing = false;
          td.html(
            innerTdHtml.spliceStr(
              indexOfDisplayName,
              $(this).val().length,
              $(this).val()
            )
          );
        }
      });
      var changed = false;
      input.focusout(async function () {
        if (!changed) {
          input.trigger("change");
        }
      });
      var m = 1;
      input.change(async function () {
        //console.log(_data.name, _data.newName)
        if (_data.name == _data.newName) {
          input.remove();
          editing = false;
          td.html(
            innerTdHtml.spliceStr(
              indexOfDisplayName,
              currentName.length,
              currentName
            )
          );
          return;
        } else {
          changed = true;
          //See if the file exists
          var g_data = {};
          var _parent = currentSelectedRowSelector.attr("data-tt-parent-id");
          g_data.name = _parent;
          g_data.name += configData.sep;

          g_data.name += $(this).val();
          if (currentSelectedRowSelector.attr("data-tt-ext")) {
            g_data.name += "." + currentSelectedRowSelector.attr("data-tt-ext");
          }

          try {
            $.ajax({
              method: "POST",
              headers: {
                Authorization: "Bearer " + inMemoryToken,
              },
              url: m_fsServerUrl + "/access",
              data: JSON.stringify(g_data),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: async function (res) {
                var parts = input.val().split("(");
                var modifiedName = parts[0] + "(" + m + ")";
                var ans = confirm(
                  `The file "${input.val()}" already exist. Would you like to rename it to ${modifiedName}`
                );
                if (ans) {
                  input.val(modifiedName);
                  m++;
                } else {
                  _data.newName = _data.name;
                  editing = false;
                }
                changed = false;
                input[0].focus();
              },
              error: function (res) {
                _data.newName = g_data.name;
                //console.log(488, _data)
                $.ajax({
                  method: "POST",
                  headers: {
                    Authorization: "Bearer " + inMemoryToken,
                  },
                  url: m_fsServerUrl + "/rename",
                  data: JSON.stringify(_data),
                  contentType: "application/json; charset=utf-8",
                  dataType: "json",
                  success: async function (data) {
                    input.remove();
                    editing = false;
                    changed = false;
                    selectedName = _data.newName;
                    try {
                      await doInit(_parent);
                    } catch (err) {
                      console.log("doInit failed 12")
                      alert(`Initialisation failed. Please retry.`);
                    }
                  },
                  error: function (returnval) {
                    input[0].focus();
                    input.trigger("change");
                  },
                });
              },
            });
          } catch (err) {
            console.log(50, err);
          }
        }
      });
    }

    function doDelete() {
      var message = "";
      if (currentSelectedRowSelector.attr("data-tt-file") == "file") {
        message = `Do you want to permanently remove the file "${currentSelectedRowSelector.attr(
          "data-tt-path"
        )}"?`;
      } else {
        message = `Do you want to permanently remove the folder "${selectedName}"?`;
      }
      if (!confirm(message)) {
        return;
      }
      var node = $("#filesTable").treetable(
        "node",
        currentSelectedRowSelector.attr("id")
      );
      var _parent = currentSelectedRowSelector.attr("data-tt-parent-id");
      var endPoint = "removeFolder";
      var m_selectedName = selectedName;
      if (currentSelectedRowSelector.attr("data-tt-file") == "file") {
        endPoint = "removeFile";
        m_selectedName = m_selectedName.replace("f", "");
        if (currentFilename === m_selectedName) {
          alert(`The file "${currentFilename}" is opened. Close it before deleting it.`)
          return;
        }
      }
      var _data = { name: m_selectedName };
      $.ajax({
        method: "DELETE",
        url: m_fsServerUrl + "/" + endPoint,
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        data: JSON.stringify(_data),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: async function () {
          try {
            await doInit(_parent);
            //Selected file/folder removed. Invalidate variable.
            selectedName = null;
          } catch {
            console.log("doInit failed 1");
            alert(`Initialisation failed. Please retry.`);
          }
        },
        error: function (returnval) {
          console.log(returnval.responseJSON);
          alert(`Failed to delete "${m_selectedName}". Please retry.`);
          currentSelectedRowSelector.toggleClass("selected")
        },
      });
    }

    function addFile() {
      //console.log(225)
      var _parent = $("#parent1").val();
      var _data = {
        id: "inputRowId",
        isFile: true,
        displayName: "",
        parentId: _parent,
        parentPath: _parent,
      };
      var node = null;
      if (currentSelectedRowSelector) {
        node = $("#filesTable").treetable(
          "node",
          currentSelectedRowSelector.attr("id")
        );
      }
      var input = $('<input type="text"/>');
      input.val($("#name").val()); //init text input
      var inputRow = makeRow(_data);
      $("#filesTable").treetable("loadBranch", node, inputRow);
      editing = true;
      var td = $(inputRow.children()[0]);
      td.append(input);
      input[0].focus();
      var _ext = $("#saveAsType").val();
      //_data.parent = _parent; //parent name
      var error = false;

      var changed = false;
      input.focusout(async function () {
        if (!changed) {
          //changed = false;
          input.trigger("change");
        }
      });
      var n = 1;
      input.change(async function () {
        //console.log(444);
        changed = true;
        if ($(this).val().trim() == "") {
          try {
            $("#filesTable").treetable("removeNode", inputRow.attr("id"));
          } catch (err) {
            //console.log({"removeNode Error": err})
          }
        } else {
          var m_data = {};
          m_data.name = _parent + configData.sep + $(this).val();
          if (_ext !== ".all") {
            var ext = getFileExtension($(this).val());
            if (!ext || _ext !== ext) {
              m_data.name += _ext;
            }
          }
          //See if the file exists
          try {
            $.ajax({
              method: "POST",
              url: m_fsServerUrl + "/access",
              headers: {
                Authorization: "Bearer " + inMemoryToken,
              },
              data: JSON.stringify(m_data),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: async function (res) {
                var parts = input.val().split("(");
                var modifiedName = parts[0] + "(" + n + ")";
                var ans = confirm(
                  `The file "${input.val()}" already exist. Would you like to rename it to ${modifiedName}`
                );
                if (ans) {
                  input.val(modifiedName);
                  n++;
                } else {
                  input.val("");
                  editing = false;
                }
                changed = false;
                input[0].focus();
              },
            });
          } catch (err) {
            console.log(50, err);
          }
          $.ajax({
            method: "POST",
            url: m_fsServerUrl + "/createFile",
            headers: {
              Authorization: "Bearer " + inMemoryToken,
            },
            data: JSON.stringify(m_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: async function (data) {
              //refresh
              try {
                await doInit(_parent);
                editing = false;
              } catch {
                console.log("doInit failed 2");
                alert(`Initialisation failed. Please retry.`);
              }
            },
            error: function (returnval) {
              var parts = input.val().split("(");
              var modifiedName = parts[0] + "(" + n + ")";
              var ans = confirm(
                `The file "${input.val()}" already exist. Would you like to rename it to ${modifiedName}`
              );
              if (ans) {
                input.val(modifiedName);
                n++;
              } else {
                input.val("");
                editing = false;
              }
              changed = false;
              input[0].focus();
            },
          });
        }
      });
    }

    var addingFolder = false;

    function addFolder(_data) {
      var _parent = $("#parent1").val();
      var _data = {
        id: "inputRowId",
        isFile: false,
        displayName: "",
        parentId: _parent,
        parentPath: _parent,
      };
      addingFolder = true;
      var node = null;
      if (currentSelectedRowSelector) {
        node = $("#filesTable").treetable(
          "node",
          currentSelectedRowSelector.attr("id")
        );
      }
      var input = $('<input type="text"/>');
      var inputRow = makeRow(_data);
      $("#filesTable").treetable("loadBranch", node, inputRow);
      var td = $(inputRow.children()[0]);
      td.append(input);
      input[0].focus();
      input.focusout(function () {
        addingFolder = false;
        var str = $(this).val().trim();
        if ($(this).val().trim() == "") {
          try {
            $("#filesTable").treetable("removeNode", inputRow.attr("id"));
          } catch {
            //console.log("removeNode fail");
          }
        }
      });
      input.change(function () {
        addingFolder = false;
        var m_data = {};
        m_data.name = _parent + configData.sep + $(this).val();
        if ($(this).val().trim() !== "") {
          $.ajax({
            method: "POST",
            url: m_fsServerUrl + "/createFolder",
            headers: {
              Authorization: "Bearer " + inMemoryToken,
            },
            data: JSON.stringify(m_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: async function (data) {
              //refresh
              try {
                await doInit(_parent);
              } catch {
                console.log("doInit failed 3");
                alert(`Initialisation failed. Please retry.`);
              }
            },
            error: function (returnval) {
              //console.log(returnval.responseJSON);
              alert(returnval.responseJSON.msg);
              input[0].focus();
            },
          });
        }
      });
    }

    let openFileWithSubmenu = [];

    async function openFileWithEditorChoosenByExt() {
      const filename = selectedName.replace("f", "");
      let ext = selectedName.slice(selectedName.length - 4);
      if (ext.charAt(0) !== ".") {
        ext = ".all"
      }
      try{
        const editor = await chooseEditor.chooseEditorByExt(editors, ext);
        //console.log(456, editor)
        openFile(filename, { editorName: editor.m_data.name })
      }catch(err){
        console.log(err)
      }
    }

    openFileWithSubmenu.push({
      name: "Choose...",
      title: `Launches the choose dialog`,
      fun: function () {
        openFileWithEditorChoosenByExt();
      },
    })

    var menuNotSelectedSubmenu = [
      {
        //pos: 0,
        name: "Folder",
        // img: 'images/brush.png',
        title: "Creates a new folder.",
        fun: function () {
          //console.log("Create a new folder.");
          if (addingFolder) return;
          if (
            currentSelectedRowSelector &&
            currentSelectedRowSelector.attr("data-tt-file") == "file"
          )
            return;
          //var _data = { "parent": name, "isFile": false, "name": "" };
          addFolder();
        },
      },
      {
        //pos: 4,
        //disable: true,
        name: "Text Document",
        //img: 'images/scissors.png',
        title: "Creates a new text document.",
        fun: function () {
          $("#name").val("New Text Document");
          $("#saveAsType").val(".txt");
          updateFilesTable();
          if (
            currentSelectedRowSelector &&
            currentSelectedRowSelector.attr("data-tt-file") == "file"
          )
            return;
          addFile();
        },
      },
    ];

    //build the sub-menu for 'new'
    listOfFileTypes.forEach((item) => {
      var menuItem = {
        name: item.defaultFilename,
        title: `Creates a new ${item.defaultFilename}.`,
        fun: function () {
          $("#name").val(`New ${item.defaultFilename}`);
          $("#saveAsType").val(item.ext);
          if (
            currentSelectedRowSelector &&
            currentSelectedRowSelector.attr("data-tt-file") == "file"
          )
            return;
          addFile();
        },
      };
      menuNotSelectedSubmenu.push(menuItem);
    });

    listOfOpenWithTypes.forEach((item) => {
      var menuItem = {
        name: item.name,
        title: `Opens with ${item.name}.`,
        fun: function () {
          openFileWith({ editorName: item.name, options: item.options });
        },
      };
      openFileWithSubmenu.push(menuItem);
    });

    var menuNotSelected = [
      {
        //disable: true,
        name: "New",
        title: "Creates a new folder or file",
        subMenu: menuNotSelectedSubmenu,
      },
    ];

    var openFileWithMenu = {
      //disable: true,
      name: "Open with...",
      title: "Opens the current selection",
      subMenu: openFileWithSubmenu,
    };

    let nodeToCopy = null;
    let nodeCut = false;



    function copyNode() {
      nodeToCopy = selectedName
      if (currentSelectedRowSelector.attr("data-tt-file") == "file") {
        nodeToCopy = nodeToCopy.replace("f", "");
      }
    }

    function cutNode() {
      nodeToCopy = selectedName
      if (currentSelectedRowSelector.attr("data-tt-file") == "file") {
        nodeToCopy = nodeToCopy.replace("f", "");
      }
      nodeCut = true;
    }

    function pasteNode(cb) {
      let dest = selectedName || $("#parent1").val();
      const src = nodeToCopy;
      if (`f${src}` === dest) {
        dest = $("#rootDir").val();
      }

      const arr = nodeToCopy.split(configData.sep)
      const name = dest + configData.sep + arr[arr.length - 1];
      //console.log("name", name)
      let m_data = { src, dest };
      $.ajax({
        method: "POST",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        url: m_fsServerUrl + "/access",
        data: JSON.stringify({ name }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: async function (res) {
          if (confirm(`File with the name "${name}" already exist. Do you want to replace it?`)) {
            $.ajax({
              method: "POST",
              url: m_fsServerUrl + "/copyFile",
              headers: {
                Authorization: "Bearer " + inMemoryToken,
              },
              data: JSON.stringify(m_data),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: async function (cpyName) {
                nodeToCopy = null;
                cb && cb(src)
              },
              error: function (err) {
                console.log(err.responseJSON);
                cb && cb(null)
              },
            });
          }
        },
        error: async function (res) {
          $.ajax({
            method: "POST",
            url: m_fsServerUrl + "/copyFile",
            headers: {
              Authorization: "Bearer " + inMemoryToken,
            },
            data: JSON.stringify(m_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: async function (cpyName) {
              nodeToCopy = null;
              cb && cb(src);
            },
            error: function (err) {
              console.log(err.responseJSON);
              cb && cb(null)
            },
          });
        }
      });

    }

    var pasteMenu = {
      //disable: true,
      name: "Paste",
      title: "Paste the current selection",
      fun: function () {
        pasteNode(async (cpy) => {
          if (nodeCut) {
            $.ajax({
              method: "DELETE",
              url: m_fsServerUrl + "/removeFile",
              headers: {
                Authorization: "Bearer " + inMemoryToken,
              },
              data: JSON.stringify({ name: cpy }),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: async function () {
                try {
                  await doInit($("#parent1").val());
                  nodeCut = false;
                } catch {
                  console.log("doInit failed 5");
                  alert(`Initialisation failed. Please retry.`);
                }
              },
              error: function (returnval) {
                console.log(returnval.responseJSON);
                alert(returnval.responseJSON);
              },
            });
          } else {
            try {
              await doInit($("#parent1").val());
            } catch {
              console.log("doInit failed 6");
            }
          }
        });
      },
    };

    var menuSelected = [
      {
        //pos: 0,
        name: "Open",
        // img: 'images/brush.png',
        title: "Opens the current selection.",
        fun: function () {
          currentSelectedRowSelector.trigger("dblclick");
        },
      } /* ,

      openFileWithMenu */,
      {
        //pos: 0,
        name: "Rename",
        // img: 'images/brush.png',
        title: "Renames the current selection.",
        fun: function () {
          renameNode();
        },
      },
      {
        //pos: 0,
        name: "Cut",
        // img: 'images/brush.png',
        title: "Cuts the current selection.",
        fun: function () {
          cutNode();
        },
      },
      {
        //pos: 0,
        name: "Copy",
        // img: 'images/brush.png',
        title: "Copies the current selection.",
        fun: function () {
          copyNode();
        },
      },
      {
        //pos: 4,
        name: "Delete",
        //img: 'images/scissors.png',
        title: "Deletes current selection.",
        fun: function () {
          doDelete();
        },
      }
    ];

    var pointIn = false;

    $("#menuElement").mouseenter(() => {
      pointIn = true;
    });

    $("#menuElement").mouseleave(() => {
      pointIn = false;
    });

    var menuActive = false;
    $("#explorerSaveAsModal").mousedown(function (e) {
      if (e.button != 2 || !pointIn /* || !filesTableRowSelected */) {
        //not right button
        if (menuActive) {
          $("#explorerSaveAsModal").contextMenu("destroy");
          menuActive = false;
        }
        return;
      }

      if (currentSelectedRowSelector && !rigthClickOnSelectedRow) {
        currentSelectedRowSelector.toggleClass("selected"); //deselect
        currentSelectedRowSelector = null;
        filesTableRowSelected = false;
        filesTableFileSelected = false;
      }

      menuActive = true;
      if (currentSelectedRowSelector) {
        //console.log("File");
        if (currentSelectedRowSelector.attr("data-tt-file") == "file") {
          //file selected. Add openFileWithMenu
          if (
            openFileWithSubmenu.length > 0 &&
            menuSelected[1].name !== "Open with..."
          ) {
            menuSelected.splice(1, 0, openFileWithMenu);
          }
          if (
            menuSelected[0].name === "Paste"
          ) {
            menuSelected.splice(0, 1);
          }
        } else {
          //file not selected. Remove openFileWithMenu
          if (
            openFileWithSubmenu.length > 0 &&
            menuSelected[1].name === "Open with..."
          ) {
            menuSelected.splice(1, 1);
          }
          if (nodeToCopy) {
            if (menuSelected[0].name !== "Paste") {
              menuSelected.splice(0, 0, pasteMenu);
            }
          } else {
            if (
              menuSelected[0].name === "Paste"
            ) {
              menuSelected.splice(0, 1);
            }
          }
        }
      }

      if (nodeToCopy) {
        if (menuNotSelected[0].name !== "Paste") {
          menuNotSelected.splice(0, 0, pasteMenu);
        }
      } else {
        if (
          menuNotSelected[0].name === "Paste"
        ) {
          menuNotSelected.splice(0, 1);
        }
      }


      var menu = filesTableRowSelected == true ? menuSelected : menuNotSelected;
      $("#explorerSaveAsModal").contextMenu(menu, {
        triggerOn: "contextmenu touchstart",
      });
      rigthClickOnSelectedRow = false;
    });

    $("#saveAsType").append($('<option value=".all">All Files</option>'));
    fileExtensions.push(".all");
    $("#saveAsType").append(
      $('<option value=".txt">Text documents (*.txt)</option>')
    );
    fileExtensions.push(".txt");

    for (var i = 0; i < listOfFileTypes.length; ++i) {
      $("#saveAsType").append(
        $(
          "<option value=" +
          listOfFileTypes[i].ext +
          ">" +
          listOfFileTypes[i].display +
          "</option>"
        )
      );
      fileExtensions.push(listOfFileTypes[i].ext);
    }

    function getChildren(nodeName) {
      var result = [];
      for (var i = 0; i < nodes.length; ++i) {
        if (nodes[i].path.length > nodeName.length) {
          if (
            nodes[i].path.indexOf(nodeName) !== -1 &&
            nodes[i].parentPath == nodeName
          ) {
            result.push(nodes[i]);
          }
        }
      }
      return result;
    }

    function selectRow(row) {
      if (typeof row == "string") row = $(document.getElementById(row));
      if (currentRowSelector && currentRowSelector.hasClass("selected"))
        currentRowSelector.toggleClass("selected");
      if (row) {
        row.toggleClass("selected");
      }
      var idAttr = null;
      if (row && row.hasClass("selected")) {
        filesTableRowSelected = false;
        idAttr = row.attr("data-tt-id");

        if (row.attr("data-tt-parent-id")) {
          var nodeIds = row.attr("data-tt-parent-id").split(configData.sep);
          var id = "";
          for (var i = 0; i < nodeIds.length; ++i) {
            if (i > 0) {
              id += configData.sep;
            }
            id += nodeIds[i];
            $("#foldersTable").treetable("expandNode", id);
          }
        }
      }
      if (!idAttr) {
        return false;
      }
      currentRowSelector = row;
      name = idAttr; //long name
      parentName = row.attr("data-tt-parent-id");
      return true;
    }

    // Highlight selected row

    function clearFilesTable() {
      var chdrn = $($("#filesTable").children()[0]).children();
      for (var i = 0; i < chdrn.length; ++i) {
        $(chdrn[i]).remove();
      }
    }

    $("#saveAsType").on("change", () => {
      updateFilesTable();
    });

    function getFileExtension(name) {
      var l = name.length;
      var str = name[l - 4];
      if (str !== ".") return null;
      str += name[l - 3];
      str += name[l - 2];
      str += name[l - 1];
      if (str == ".all") return null;
      return str;
    }

    function updateFilesTable() {
      clearFilesTable();
      var children = getChildren(name);
      for (var i = 0; i < children.length; ++i) {
        var _name = children[i].path;
        //console.log(_name)
        if (children[i].isFile) {
          var selectedExtType = $("#saveAsType").val();
          if (selectedExtType == ".all") {
            addRow(children[i]);
            continue;
          } else {
            if (children[i].ext) {
              const dotExt = "." + children[i].ext;
              if (dotExt == selectedExtType) {
                addRow(children[i]);
              }
              continue;
            }
          }
        } else {
          addRow(children[i]);
        }
      }
    }

    $("#foldersTable tbody").on("mousedown", "tr", function (e) {
      if (e.button != 0) {
        return;
      }
      $(".selected").not(this).removeClass("selected");
      selectRow($(this));
      $("#parent1").val(name);
      if ($(this).hasClass("selected")) {
        if ($(this).attr("data-tt-file") !== "file") {
          //we selected a folder
          updateFilesTable();
        }
      }
    });

    // Highlight selected row
    $("#filesTable tbody").on("mousedown", "tr", function (e) {
      if (e.button == 2) {
        if (currentSelectedRowSelector) {
          if (currentSelectedRowSelector.attr("id") !== $(this).attr("id")) {
            //right click on a non-selected row
            currentSelectedRowSelector.toggleClass("selected"); //deselect
            currentSelectedRowSelector = null;
            filesTableRowSelected = false;
            filesTableFileSelected = false;
            rigthClickOnSelectedRow = false;
          } else {
            rigthClickOnSelectedRow = true;
          }
        } else {
          rigthClickOnSelectedRow = false;
        }
        return;
      }
      if (e.button != 0 || editing) {
        return;
      }
      selectedName = null;
      $(".selected").not(this).removeClass("selected");
      $(this).toggleClass("selected");
      if ($(this).hasClass("selected")) {
        filesTableRowSelected = true;
        selectedName = $(this).attr("id");
        if ($(this).attr("data-tt-file") == "file") {
          filesTableFileSelected = true;
          $("#name").val($(this).attr("data-tt-displayName"));
          var ext = getFileExtension(selectedName) || ".all";
          $("#saveAsType").val(ext);
        } else {
          filesTableFileSelected = false;
        }
        currentSelectedRowSelector = $(this);
      } else {
        filesTableRowSelected = false;
        currentSelectedRowSelector = null;
        rigthClickOnSelectedRow = false;
      }
      var _parent = $(this).attr("data-tt-parent-id");
    });

    $("#filesTable tbody").on("dblclick", "tr", function () {
      //console.log()
      /* if(editing){
        return;
      } */
      var _name = $(this).attr("id");
      if ($(this).attr("data-tt-file") !== "file") {
        //we selected a folder
        //var _name = $(this).attr("id");
        //console.log(111, _name)
        selectRow(_name);
        $("#parent1").val(_name);
        updateFilesTable();
      } else {
        if (!editing) openFile($(this).attr("data-tt-path"), { editorName: $("#explorerSaveAsModal").attr("editorName") });
      }
    });


    function drag(ev) {
      ev.originalEvent.dataTransfer.setData("text", $(this).attr("id"));
    }

    function allowDrop(ev) {
      ev.preventDefault();
    }

    function drop(ev) {
      ev.preventDefault();
      var originalNode = $(
        document.getElementById(ev.originalEvent.dataTransfer.getData("text"))
      );
      var finalNode = $(document.getElementById($(this).attr("id")));
      //console.log("nodes:", originalNode, finalNode)
      if (finalNode.attr("data-tt-file") !== "file") {
        var originalPath =
          originalNode.attr("data-tt-path") || originalNode.attr("id");
        var finalPath = finalNode.attr("data-tt-id");
        if (finalPath.indexOf(originalPath) !== -1) {
          //cannot drop on descendant
          console.log(789);
          return;
        }
        var parts = originalPath.split(configData.sep);
        var originalBasename = parts[parts.length - 1];
        var newName = finalPath + configData.sep + originalBasename;

        if (originalPath == newName) {
          return;
        }
        let m_data = { name: originalPath, newName: newName };
        $.ajax({
          method: "POST",
          url: m_fsServerUrl + "/rename",
          headers: {
            Authorization: "Bearer " + inMemoryToken,
          },
          data: JSON.stringify(m_data),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          success: async function (data) {
            if (originalNode.attr("data-tt-file") === "file") {
              try {
                await doInit(finalPath);
              } catch {
                console.log("doInit failed 7");
                alert(`Initialisation failed. Please retry.`);
              }
            } else {
              try {
                await doInit(newName);
              } catch {
                console.log("doInit failed 8");
                alert(`Initialisation failed. Please retry.`);
              }
            }
          },
          error: function (err) {
            if (err.responseJSON.msg === "File with that name already exist") {
              if (confirm(`File with the name "${newName}" already exist. Do you want to replace it?`)) {
                m_data.replaceFile = true;
                //console.log(456, m_data)
                $.ajax({
                  method: "POST",
                  url: m_fsServerUrl + "/rename",
                  headers: {
                    Authorization: "Bearer " + inMemoryToken,
                  },
                  data: JSON.stringify(m_data),
                  contentType: "application/json; charset=utf-8",
                  dataType: "json",
                  success: async function (data) {
                    //console.log(457, m_data)
                    if (originalNode.attr("data-tt-file") === "file") {
                      try {
                        await doInit(finalPath);
                      } catch {
                        console.log("doInit failed 9");
                        alert(`Initialisation failed. Please retry.`);
                      }
                    } else {
                      try {
                        await doInit(newName);
                      } catch {
                        console.log("doInit failed 10");
                        alert(`Initialisation failed. Please retry.`);
                      }
                    }
                  },
                  error: function (err) {
                    //console.log(458, m_data)
                    console.log(err.responseJSON);
                  },
                });
              }
              //console.log(err.responseJSON);
            }
          },
        });
      }
    }

    function makeRow(rootData) {
      var row = null;
      if (rootData.isFile) {
        if (imageFileSrc)
          row = $(
            '<tr draggable="true"><td><img src=' + imageFileSrc + '> ' +
            rootData.displayName +
            "</td></tr>"
          );
        else
          row = $(
            '<tr draggable="true"><td>' + rootData.displayName + '</td></tr>'
          );
        row.attr("data-tt-file", "file");
        row.attr("data-tt-ext", rootData.ext);
        row.attr("data-tt-path", rootData.path);
      } else {
        if (imageFolderSrc)
          row = $(
            '<tr><td><img src=' + imageFolderSrc + '> ' +
            rootData.displayName +
            "</td></tr>"
          );
        else
          row = $(
            '<tr><td>' + rootData.displayName + '</td></tr>'
          );
        row.attr("data-tt-file", "folder");
      }
      row.attr("data-tt-displayName", rootData.displayName);
      var _id = rootData.id;
      row.attr("data-tt-id", _id);
      row.attr("id", _id);
      if (rootData.parentPath !== undefined && rootData.parentPath !== "") {
        row.attr("data-tt-parent-id", rootData.parentId); //name is parent
      }
      if (rootData.path == configData.rootDir) {
        currentRowSelector = row;
      }
      row.on("dragstart", drag);
      row.on("dragover", allowDrop);
      row.on("drop", drop);
      return row;
    }

    function addRow(rootData) {
      $($("#filesTable").children()[0]).append(makeRow(rootData));
    }

    var optns = {
      expandable: true,
      clickableNodeNames: true,
    };

    $("#filesTable").treetable(optns /* , true */);

    var initialized = false;

    async function openFileSuccessFunction(filename, data, editorName) {
      let editor = null;
      if (editorName !== undefined) {//a specific editor is requested       
        editor = getEditorByName(editorName);              
      } else {
        //editor = chooseEditor.getEditorStoredChoice(getFileExtension(filename));//choose how to open governs
        //if(!editor){
          editor = await chooseEditor.getEditorByExt(editors, getFileExtension(filename));
       // }        
      }
      $(window).trigger("fieOpened", [data, filename, getFileExtension(filename), editor.name]);
      if (editor) {
        editor.setData(data, filename, getFileExtension(filename), editorName);
      } else { //If we get here, we use fs default setData() method
        self.setData && self.setData(data, filename, getFileExtension(filename));
      }
      currentFilename = filename;
      //editorName = editorName || null;
      //$(window).trigger("fieOpened", [data, filename, getFileExtension(filename), editorName]);
    }

    function openFile(filename, { editorName, options }) {
      $(window).trigger("beforeOpen", [filename, getFileExtension(filename), editorName || null]);
      //console.log(2000, filename)
      options = options || { encoding: "utf8", flag: "r" };
      var _data = { name: filename, options: options };
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/readStream",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        data: JSON.stringify(_data),
        contentType: "application/json; charset=utf-8",
        beforeSend: function () {
          if (imageLoaderSrc)
            $("#imageLoader").show();
        },
        complete: function () {
          if (imageLoaderSrc)
            $("#imageLoader").hide();
        },
        success: function (data) {
          openFileSuccessFunction(filename, data, editorName);          
        },
        error: function (returnval) {
          console.log(returnval.responseJSON);
          alert("Unexpected error. Please retry.");
        },
      });
    }


    function openFileWith(obj) {
      openFile(currentSelectedRowSelector.attr("data-tt-path"), obj);
    }

    $("#dlgSaveButton").click(async () => {
      try {
        const ext =
          $("#saveAsType").val() == ".all" ? null : $("#saveAsType").val();
        let data = null;
        const editor = getEditorByName($("#explorerSaveAsModal").attr("editorName"))
        if (editor) {
          data = editor.getData(ext);
        } else {
          data = self.getData(ext);
        }
        await self.saveAs(data);
        //$("#explorerSaveAsModal").attr("editorName", null);
        $("#explorerSaveAsModal").modal("toggle");
      } catch {
        $("#name")[0].focus();
      }
    });

    $(".config-close").click(() => {
      $("#configModal").modal("toggle");
    });

    function doConfigDlg() {
      getConfigFs((data) => {

        $("#rootDir").val(data.rootDir || "root:");
        $("#sep").val(data.sep || "\\");
        $("#dialog-background-color").val(
          data.dialogBackgroundColor || "#ffffff"
        );
        $("#input-background-color").val(
          data.inputBackgroundColor || "#ffffff"
        );
        $("#gridfs-storage").prop("checked", data.gridFsStorage);
        $("#configModal").modal();
      });
    };

    $("#config-ok-button").click(async () => {
      configData.gridFsStorage = $("#gridfs-storage").prop("checked");
      configData.rootDir = $("#rootDir").val();
      configData.sep = $("#sep").val();
      configData.dialogBackgroundColor = $("#dialog-background-color").val();
      configData.inputBackgroundColor = $("#input-background-color").val();
      setConfigFs(configData, async (err) => {
        try {
          try {
            await doInit(configData.rootDir);
          } catch {
            console.log("doInit failed 11");
            alert(`Initialisation failed. Please retry.`);
          }
        } catch (err) {
          console.log("Init failed");
          alert(`Initialisation failed. Please retry.`);
        }
        if (!err) {
          $("#configModal").modal("toggle");
        }
      });
    });

    function doLogin() {
      $("#dlg-repeat-row").hide();
      $("#dlg-email-row").hide();
      $("#dlg-title").html("Sign In");
      $("#dlg-ok-button").val("Sign In");
      $("#dlg-password").val("");
      $("#registerLoginModal").modal();
    };

    function doRegister() {
      $("#dlg-repeat-row").show();
      $("#dlg-email-row").show();
      $("#dlg-title").html("Sign Up");
      $("#dlg-ok-button").val("Sign Up");
      $("#dlg-password").val("");
      $("#dlg-repeat-password").val("");
      $("#registerLoginModal").modal();
    };

    function validateEmail(email) {
      const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      return re.test(email);
    }


    $("#dlg-ok-button").on("click", () => {
      if ($("#dlg-title").html() == "Sign In") {
        self.connectFs(
          $("#registerLoginForm").serializeJSON(),
          (data) => {
            //console.log(1235, data)
            if (data.error) {
              alert(data.msg);
              if (data.msg === "Not registered.")
                doRegister();
              return;
            } else {
              $("#dlg-password").val("");
              if (mongoFsLoginLogoutRegisterSeletor) {
                mongoFsLoginLogoutRegisterSeletor.contextMenu(mongoFsLoginLogoutRegisterMenu2, { zIndex: 2000 });
              }
              console.log(data.msg);
              $("#registerLoginModal").modal("toggle");
            }
          }
        );
      } else {
        if (!validateEmail($("#dlg-email").val())) {
          alert("Invalid email");
          return;
        }
        if ($("#dlg-password").val() !== $("#dlg-repeat-password").val()) {
          alert("Password different from repeat-password");
          return;
        }

        self.registerFs(
          $("#registerLoginForm").serializeJSON(),
          (data) => {
            if (!data.success) {
              alert(data.msg);
              $("#dlg-username").val("");
              $("#dlg-email").val("");
              $("#dlg-password").val("");
              $("#dlg-repeat-password").val("");
            } else {
              $("#dlg-password").val("");
              $("#dlg-repeat-password").val("");
              $(window).trigger("registered", $("#dlg-username").val());
              $("#registerLoginModal").modal("toggle");
            }
          }
        );
      }
    });

    $("#dlg-password").keyup(function (e) {
      if ($("#dlg-title").html() == "Sign In") {
        if (e.keyCode === 13) {
          $("#dlg-ok-button").trigger("click");
        }
      }
    });

    $("#dlg-repeat-password").keyup(function (e) {
      if (e.keyCode === 13) {
        $("#dlg-ok-button").trigger("click");
      }
    });

    $("#configButton").click(() => {
      doConfigDlg();
    });

    $("#dlg-cancel-button").on("click", () => {
      $("#registerLoginModal").modal("toggle");
    });

    let mongoFsLoginLogoutRegisterSeletor = $(
      ".mongo-fs-login-logout-register"
    );
    if (!mongoFsLoginLogoutRegisterSeletor[0]) {
      mongoFsLoginLogoutRegisterSeletor = null;
    }
    //console.log(111, mongoFsLoginLogoutRegisterSeletor)
    if (mongoFsLoginLogoutRegisterSeletor) {
      const glyphiconUser = $('<span class="glyphicon glyphicon-user"></span>');
      mongoFsLoginLogoutRegisterSeletor.html("Mongo File System(MFS)");
      mongoFsLoginLogoutRegisterSeletor.append(glyphiconUser);
      mongoFsLoginLogoutRegisterSeletor.attr(
        "title",
        "Register for or Login to Mongo File System"
      );

      mongoFsLoginLogoutRegisterSeletor.contextMenu(mongoFsLoginLogoutRegisterMenu, { zIndex: 2000 });

    }

    this.saveAs = function (fileData, _flag) {
      return new Promise((resolve, reject) => {
        //console.log(225)
        const flag = _flag || "wx";
        var _data = {};
        _data.options = { encoding: "utf8", mode: 0o666, flag };
        _data.name = $("#parent1").val() + configData.sep + $("#name").val();
        _data.data = fileData;
        const ext = $("#saveAsType").val();
        if (ext !== ".all") {
          _data.name += ext;
        }
        currentFilename = _data.name;
        $(window).trigger("beforeEditorSaveAs", [_data.name]);
        $.ajax({
          method: "POST",
          url: m_fsServerUrl + "/createFile",
          headers: {
            Authorization: "Bearer " + inMemoryToken,
          },
          data: JSON.stringify(_data),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          beforeSend: function () {
            if (imageLoaderSrc)
              $("#imageLoader").show();
          },
          complete: function () {
            if (imageLoaderSrc)
              $("#imageLoader").hide();
          },
          success: function (data) {
            $(window).trigger("afterSave");
            $(window).trigger("fileSaved", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
            $(window).trigger("afterEditorSaveAs", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
            //currentFileSaved();
            resolve(true);
          },
          error: async function (err) {
            if (confirm(`A file with the name "${_data.name}" already exist. Would you like to replace it ?`)) {
              try {
                await self.saveAs(fileData, "w");
                $(window).trigger("fileSaved", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
                $(window).trigger("afterEditorSaveAs", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
                resolve(true);
              } catch (err) {
                $(window).trigger("afterEditorSaveAs", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
                reject(false);
              }
            } else {
              $(window).trigger("afterEditorSaveAs", [_data.name, $("#explorerSaveAsModal").attr("editorName")]);
              reject(false);
            }
          },
        });
      });
    }

    this.save = function (filename, fileData/* , _flag */) {
      return new Promise((resolve, reject) => {
        $(window).trigger("beforeSave", filename);
        var _data = {};
        _data.options = { encoding: "utf8", mode: 0o666, flag: "w" };
        _data.name = filename;
        _data.data = fileData;
        const ext = getFileExtension(filename);
        if (!ext) {
          _data.name += ".all";
        }
        $.ajax({
          method: "POST",
          url: m_fsServerUrl + "/writeFile",
          headers: {
            Authorization: "Bearer " + inMemoryToken,
          },
          data: JSON.stringify(_data),
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          beforeSend: function () {
            if (imageLoaderSrc)
              $("#imageLoader").show();
          },
          complete: function () {
            if (imageLoaderSrc)
              $("#imageLoader").hide();
          },
          success: function (data) {
            $(window).trigger("afterSave")
            $(window).trigger("fileSaved", [filename, $("#explorerSaveAsModal").attr("editorName")]);
            //currentFileSaved()
            resolve(true);
          },
          error: function (err) {
            reject(false);
          },
        });
      });
    }

    $("#foldersTable").treetable(options);

    let prevRoot = options.rootDir || "root:";

    function doInit(selectedFolder) {
      return new Promise((resolve, reject) => {
        $("#dlg-saveDlg").css(
          "background-color",
          configData.dialogBackgroundColor || "#ffffff"
        );
        $(".inputClass").css(
          "background-color",
          configData.inputBackgroundColor || "#ffffff"
        );
        $.ajax({
          method: "GET",
          headers: {
            Authorization: "Bearer " + inMemoryToken,
          },
          url: m_fsServerUrl + "/tree",
          success: function (data) {
            nodes = data.tree;
            //console.log(1000, nodes)
            if (initialized) {
              $("#foldersTable").treetable("removeNode", prevRoot);
            } else {
            }
            //selectedFolder = configData.rootDir;
            prevRoot = configData.rootDir;
            for (var i = 0; i < data.tree.length; ++i) {
              if (!data.tree[i].isFile) {
                var parentNode = $("#foldersTable").treetable(
                  "node",
                  data.tree[i].parentId
                );
                $("#foldersTable").treetable(
                  "loadBranch",
                  parentNode,
                  makeRow(data.tree[i])
                );
              }
            }
            initialized = true;
            $("#foldersTable").treetable("collapseAll");
            selectRow(selectedFolder);
            updateFilesTable();
            var m_name = selectedFolder;
            //console.log(222, m_name)
            $("#parent1").val(m_name);

            resolve(true);
          },
          error: function (returnval) {
            reject(false);
          },
        });
      });
    }

    async function init() {
      try {
        await doInit(configData.rootDir);
      } catch (err) {
        console.log("doInit failed 13");
        alert(`Initialisation failed. Please retry.`);
      }
    };

    /* email is optional */
    this.registerFs = function (registerData, cb) {
      if (typeof registerData === "function") {
        cb = registerData;
        registerData = undefined;
      }
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/registerFs",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        data: JSON.stringify(registerData),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          cb && cb(data);
        },
        error: function (data) {
          cb && cb(data);
        },
      });
    };

    function getConfigFs(cb) {
      $.ajax({
        method: "GET",
        url: m_fsServerUrl + "/config",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          cb(data);
        },
        error: function (data) {
          cb(data);
        },
      });
    };

    function setConfigFs(data, cb) {
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/config",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function () {
          cb(null);
        },
        error: function (data) {
          cb(data.responseJSON);
        },
      });
    };

    this.connectFs = function (connectData, cb) {
      if (typeof connectData === "function") {
        cb = connectData;
        connectData = undefined;
      }
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/connect",
        data: JSON.stringify(connectData),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          inMemoryToken = data.accessToken;
          if (!options.sameDomain) {
            self.storeRefreshToken(data.refreshToken);
          }
          clearTimeout(timer);//ensure any earlier timeout is cleared
          countDown(); //monitor expiration
          configData = data.configData;
          name = configData.rootDir;
          cb && cb({ error: false, msg: "Connected" });
          $(window).trigger("connected", data.username);
        },
        error: function (data) {
          //console.log(4001, data)
          cb && cb(data.responseJSON);
        },
      });
    };

    this.disconnectFs = function (cb) {
      $(window).trigger("disconnected");
      stopCountDown();
      // to support logging out from all windows
      localStorage.setItem('logout', Date.now());
      const refreshToken = self.getRefreshToken();
      if (!refreshToken) {
        inMemoryToken = null;
        cb && cb({ error: false, msg: "Disconnected: refresh token not found" });
        return;
      }
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/disconnect",
        headers: {
          Authorization: "Bearer " + inMemoryToken,
        },
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ refreshToken }),
        dataType: "json",
        success: function (data) {
          inMemoryToken = null;
          self.clearRefreshToken();
          cb && cb({ error: false, msg: "Disconnected" });
        },
        error: function (data) {
          cb && cb({ error: true, msg: data.responseJSON });
        },
      });
    };

    this.isConnected = async function () {
      return inMemoryToken !== null;
    }

    window.addEventListener('storage', (event) => {
      //console.log("event.key", event.key)
      if (event.key === 'logout') {
        console.log('logged out from storage!');
        //location.reload()
      }
    })

    function breakdown() {
      $.ajax({
        method: "DELETE",
        url: m_fsServerUrl + "/breakdown",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          //console.log(data.msg)
        },
        error: function (data) {
          console.log(data);
        },
      });
    }


    window.onbeforeunload = function (e) {
      for (let i = 0; i < editors.length; ++i) {
        if (editors[i].editor.currentFileModified()) {
          e.preventDefault();
          e.returnValue = '';
          return "";
        }
      }
      if (!options.persistSession) {
        self.disconnectFs();
      }
      breakdown();
    };


    window.addEventListener('load', (event) => {
      self.clearRefreshToken();
    });

    function refreshSession() {
      if (options.persistSession) {
        refresh((err, data) => {
          if (err) {
            console.log(data.responseJSON.msg)
          } else {
            $.ajax({
              method: "POST",
              url: m_fsServerUrl + "/re-connect",
              headers: {
                Authorization: "Bearer " + inMemoryToken,
              },
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: function (data) {
                /* if (mongoFsLoginLogoutRegisterSeletor) {
                  mongoFsLoginLogoutRegisterSeletor.attr(
                    "title",
                    "Logout from Mongo File System"
                  );
                  mongoFsLoginLogoutRegisterSeletor.contextMenu([]);
                } */
                if (mongoFsLoginLogoutRegisterSeletor) {
                  mongoFsLoginLogoutRegisterSeletor.contextMenu(mongoFsLoginLogoutRegisterMenu2, { zIndex: 2000 });
                }
                configData = data.configData;
                name = configData.rootDir;
                $(window).trigger("connected", data.username);
              },
              error: function (data) {
                console.log(data);
              },
            });
          }
        });
      } else {
        self.clearRefreshToken();
      }
    }

    function setup() {
      //self.clearRefreshToken();
      $.ajax({
        method: "POST",
        url: m_fsServerUrl + "/setup",
        data: JSON.stringify({ sameDomain: options.sameDomain, accessTokenExpiry: options.accessTokenExpiry }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
          refreshSession();
        },
        error: function (data) {
          console.log(data);
        },
      });
    }
    setup();
  }


  getRefreshToken() {
    return localStorage.getItem("RefreshToken");
  }

  storeRefreshToken(token) {
    localStorage.setItem("RefreshToken", token);
  }

  clearRefreshToken() {
    localStorage.removeItem("RefreshToken");
  }

  enableNotepad() {
    const editorSelector = $('<div id="notepadModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog" role="document" style="width: 98%;"> <div class="modal-content"> <div class="modal-header"> <img src="https://cdn.jsdelivr.net/gh/cah12/fs-mongo/img/file.png"> <label class="modal-title" id="notepadModalLabel">Mongo Notepad</label> <button id="closeXButton100" type="button" class="close" aria-label="Close"> <span aria-hidden="true">&times;</span> </button> </div> <div class="modal-body" > <textarea id="myNotepad" autocomplete="false" spellcheck="false" style="outline: none; resize: none; width: 100%;"></textarea> </div> <div class="modal-footer"> <button id="closeButton" type="button" class="btn btn-secondary">Close</button> <button id="notepadOpenFile" type="button" class="btn btn-primary">Open file</button> <button id="notepadSaveAs" type="button" class="btn btn-primary">Save As</button> <button id="notepadSave" type="button" class="btn btn-primary" disabled>Save</button> </div> </div> </div> </div>');
    $("body").append(editorSelector);
    $("#myNotepad").css("height", $(window).height() * 0.71);

    const options = {}
    options.fs = this;
    options.editorName = "Text Editor";
    options.fileExtensions = ['.txt', null];
    options.explorerDialogParentId = "notepadModal";
    options.idsOpen = "notepadOpenFile";
    options.idsClose = ["closeButton", "closeXButton100"];
    options.idsSave = "notepadSave";
    options.idsSaveAs = "notepadSaveAs";
    options.idEditorLabel = "notepadModalLabel"

    this.notepad = new MongoNotepad(options/* this, "Text Editor", ['.txt', null], "notepadModal" */);
    this.registerEditor({ name: "Text Editor", editor: this.notepad });
    this.addNotepadMenuItem();
  }

  //returns data. Subclass must re-implement
  /* getData() {
    console.error("getData (): Not re-implemented.");
  }

  //returns data. Subclass must re-implement
  setData(data) {
    console.warn("setData (): Not re-implemented.");
    console.log(data);
  } */

}

/* 
const options = {} 
    options.fs = fs;
    options.editorName = "Text Editor";
    options.fileExtensions = ['.txt', null];
    options.explorerDialogParentId = "notepadModal";
    options.idsOpen = "notepadOpenFile";
    options.idsClose = ["closeButton", "closeXButton100"];
    options.idsSave = "notepadSave";
    options.idsSaveAs = "notepadSaveAs";
    options.idEditorLabel = "notepadModalLabel";
*/

class Editor {
  constructor(obj/* fs, editorName, exts, explorerDialogParentId */) {
    /* const idsOpen = "notepadOpenFile";
    const idsClose = ["closeButton", "closeXButton100"];
    const idsSave = "notepadSave";
    const idsSaveAs = "notepadSaveAs";
    const idEditorLabel = "notepadModalLabel"; */

    const { fs, editorName, fileExtensions, explorerDialogParentId, idsOpen, idsClose, idsSave, idsSaveAs, idEditorLabel } = obj;

    const self = this;
    self.m_data = {};
    self.m_data.m_fs = fs;
    self.m_data.m_editor_opened = false;
    self.m_data.currentFilename = null;
    self.m_data.currentFileModified = false;

    self.m_data.currentFileSaving = false;
    self.m_data.name = editorName; //e.g. "Text Editor"
    self.m_data.editorSelector = !explorerDialogParentId ? $("body") : $(`#${explorerDialogParentId}`);


    const extensions = fileExtensions;

    let modifiedname = editorName.replaceAll(" ", "");
    let classes = {};
    classes.close = `${modifiedname}Close`;
    classes.open = `${modifiedname}Open`;
    classes.save = `${modifiedname}Save`;
    classes.saveAs = `${modifiedname}SaveAs`;
    classes.editorLabel = `${modifiedname}EditorLabel`;

    /* classes.editorLabel = null;
    if (idEditorLabel) {
      classes.editorLabel = `${idEditorLabel}EditorLabel`;
      $(`#${idEditorLabel}`).addClass(classes.editorLabel);
    } */



    function addClassToElements(ids, classType) {
      let _ids = [];
      if (typeof ids === "string") {
        _ids.push(ids);
      } else {
        _ids = ids;
      }
      for (let i = 0; i < _ids.length; ++i) {
        $(`#${_ids[i]}`).addClass(classes[classType]);
      }
    }

    idsClose && addClassToElements(idsClose, "close");
    idsOpen && addClassToElements(idsOpen, "open")
    idsSave && addClassToElements(idsSave, "save");
    idsSaveAs && addClassToElements(idsSaveAs, "saveAs");
    idEditorLabel && addClassToElements(idEditorLabel, "editorLabel");

    $(window).bind("fileSaved", function (e, filename, editorName) {
      if (editorName === self.m_data.name) {
        self.m_data.currentFileSaving = false;
        /* self.m_data.currentFileModified = false;
        --self.m_data.m_fs.modifiedFiles; */
        self.currentFileModified(false)

        $(`.${classes.save}`).attr("disabled", true);
        $(`.${classes.editorLabel}`).html(self.m_data.currentFilename + " - Mongo Notepad");
        console.log("Saved")
      }
    });

    $(window).bind("fieOpened", function (e, data, filename, ext, editorName) {
      if (editorName === self.m_data.name) {
        self.m_data.currentFilename = filename;
      }
      //$("#explorerSaveAsModal").attr("editorName", null);
    });

    async function doSave() {
      if (self.m_data.currentFilename) {
        try {
          if (!self.m_data.currentFileModified || self.m_data.currentFileSaving) {
            return;
          }
          self.m_data.currentFileSaving = true;
          let el = $("#imageLoader").detach();
          self.m_data.editorSelector.append($(el));
          await self.m_data.m_fs.save(self.m_data.currentFilename, self.getData());
          self.m_data.currentFileSaving = false;
          /* self.m_data.currentFileModified = false;
          --self.m_data.m_fs.modifiedFiles; */
          self.currentFileModified(false);
          el = $("#imageLoader").detach();
          $("#explorerSaveAsModal").append($(el));
          $(window).trigger("afterEditorSave", [self.m_data.m_editor_name]);
        } catch (err) {
          console.log(err)
          self.m_data.currentFileSaving = false;
        }
      } else {
        self.m_data.m_fs.doSaveDlg();
      }
    }


    this.currentFileModified = function (modified) {
      if (modified === undefined)
        return self.m_data.currentFileModified;
      self.m_data.currentFileModified = modified;
      /* if(modified){
        ++self.m_data.m_fs.modifiedFiles;
      }else{
        --self.m_data.m_fs.modifiedFiles;
      } */


      if (modified) {
        let title = $(`.${classes.editorLabel}`).html();
        if (title && title.charAt(0) !== "*") {
          $(`.${classes.editorLabel}`).html(`*${title}`);
        }
        if (self.currentFilename()) {
          $(`.${classes.save}`).attr("disabled", false);
        }
      }
    }

    this.editorOpened = function (opened) {
      if (opened === undefined)
        return self.m_data.m_editor_opened;
      self.m_data.m_editor_opened = opened;
      if (!opened) {
        self.m_data.m_fs.currentFilename(null);
        self.currentFileModified(false);
        self.currentFilename(null);
      }
    }

    this.currentFilename = function (filename) {
      if (filename === undefined)
        return self.m_data.currentFilename;
      self.m_data.currentFilename = filename;
    }

    this.save = function () {
      /* if (!self.m_data.m_editor_opened) {
        return;
      } */
      $("#explorerSaveAsModal").attr("editorName", self.m_data.name)
      doSave();
      return true;
    }

    this.saveAs = function () {
      /* if (!self.m_data.m_editor_opened) {
        return;
      } */
      self.setExplorerDlgParent(self.m_data.editorSelector);
      $("#explorerSaveAsModal").attr("editorName", self.m_data.name)
      self.m_data.m_fs.doSaveDlg();
    }




    this.getExtensions = function () {
      return extensions;
    }

    this.setExplorerDlgParent = function (parent) {
      let el = $("#explorerSaveAsModal").detach();
      parent.append($(el));
    }

    this.resetEditor = function () {
      self.closeEditor && self.closeEditor();
      self.setExplorerDlgParent($("body"));
      self.editorOpened(false);
    }

    this.editorClose = function (exitingFile = false) {
      const fname = self.m_data.currentFilename || "Untitled";
      if (self.currentFileModified()) {
        const ans = confirm(`Do you want to save changes to ${fname}.`)
        if (ans) {
          if (!exitingFile || fname == "Untitled") {
            saveAsFromClose = true;
            $(`.${classes.saveAs}`).click();
          } else {
            $(`.${classes.save}`).click();
            self.resetEditor();
          }
          return;
        }
      }
      self.resetEditor();
    }

    ///////////////////////////////////////////////////////////////////////////

    $(`.${classes.open}`).click(function () {
      self.openFile();
    });

    $(`.${classes.saveAs}`).click(function () {
      self.saveAs();
    });

    $(`.${classes.save}`).click(function () {
      self.save();
    });

    let saveAsFromClose = false;
    $(window).bind("afterEditorSaveAs", function (e, filename, editorName) {
      if (editorName === self.m_data.name) {
        if (saveAsFromClose) {
          self.closeEditor && self.closeEditor();
          self.setExplorerDlgParent($("body"));
          self.editorOpened(false);
          saveAsFromClose = false;
        } else {
          $(`.${classes.editorLabel}`).html(filename + " - Mongo Notepad");
          self.currentFilename(filename);
        }
      }
    });

    $(`.${classes.close}`).click(function () {
      self.editorClose();
    });


  }

  initEditor() {
    $("#notepadSave").attr("disabled", true)
    $("#notepadModalLabel").html("Untitled - Mongo Notepad");
    this.editorOpened(true);
    this.setExplorerDlgParent($("body"));
  }

  openFile() {
    /* if (!self.m_data.m_editor_opened) {
      return;
    } */
    this.setExplorerDlgParent(this.m_data.editorSelector);

    $("#explorerSaveAsModal").attr("editorName", this.m_data.name);
    this.m_data.m_fs.doExplorerDlg();
  }

  //subclass must re-implement these methods. 
  getData() {
    console.error("getData (): Not re-implemented.");
  }

  //subclass must re-implement
  setData(data, filename, ext, editorName) {
    console.error("setData (): Not re-implemented.");
  }

}



class MongoNotepad extends Editor {
  constructor(obj/* fs, name, exts, explorerDialogParentId */) {
    super(obj/* fs, name, exts, explorerDialogParentId */);
    const self = this;

    $(window).bind("fileSaved", function (e, filename, editorName) {
      if (editorName === self.m_data.name) {
        $("#myNotepad").focus();
      }
    });

    $("#myNotepad").on("input", function () {
      self.currentFileModified(true);
    });

  }

  initEditor() {
    $("#myNotepad")[0].value = "";
  }

  ///sub class implement
  openEditor() {
    super.initEditor();
    this.initEditor();
    $("#notepadModal").modal("show");
  }

  closeEditor() {
    $("#notepadModal").modal('hide');
  }

  getData() {
    return $("#myNotepad").val();
  }

  setData(data, filename) {
    if (!this.editorOpened()) {
      this.openEditor();
    }
    this.currentFilename(filename);
    $("#myNotepad")[0].value = data;
    $("#notepadModalLabel").html(filename + " - Mongo Notepad");
  }
}


class ChooseEditor {
  constructor() {
    const self = this;
    const choiceStore = {};
    let initialized = false;

    //saveDlg.append($('<div id="chooseEditorModal" class="modal fade" role="dialog" data-backdrop="static" data-keyboard="false"> <div class="modal-dialog"> <!-- Modal content--> <div class="modal-content"> <div class="modal-header"><button type="button" class="close" data-dismiss="modal">&times;</button> <h4 id="dlg-title" style="text-align: center;" class="modal-title">How would you like to open this file?</h4> </div> <div class="modal-body"><br> <div class="container"></div> <div class="row"> <div class="col-sm-1"></div> <div class="col-sm-10"> <div class="row"> <form id="chooseEditorTable" style="width: 100%;"> </form> </div> <br> <div class="row"> <label><input id="alwaysUse" type="checkbox"><span id="alwaysUseLabel"></span></label> </div> <br> <div class="row"> <div class="col-sm-6"><input type="button" id="chooseEditorCancel" class="btn btn-primary" value="Cancel" style="width: 100%" ; /></div> <div class="col-sm-6"><input type="button" id="chooseEditorOk" class="btn btn-primary" value="Ok" style="width: 100%" ; /></div> </div> </div> </div> </div> </div> </div> </div>'));

    function addToChooseEditorModal(editorName, checked = false) {
      const valueName = editorName.replaceAll(" ", "-")
      if (checked) {
        $("#chooseEditorTable").append($('<label><input type="radio" name="ChooseEditor" value=' + valueName + ' checked>' + editorName + '</label><br>'));
      } else {
        $("#chooseEditorTable").append($('<label><input type="radio" name="ChooseEditor" value=' + valueName + '>' + editorName + '</label><br>'));
      }

    }

    

    function init(editors) {
      for (let i = 0; i < editors.length; ++i) {
        addToChooseEditorModal(editors[i].editor.m_data.name, i == 0 ? true : false)
      }
      initialized = true;
    }

    this.doChooseEditorByExt = function (editors, ext) {
      return new Promise((resolve, reject) => {
        $("#chooseEditorOk").click(function () {
          delete choiceStore[ext];
          var radioValue = $("input[name='ChooseEditor']:checked").val();
          if (radioValue) {
            radioValue = radioValue.replaceAll("-", " ")
            for (let i = 0; i < editors.length; ++i) {
              if (editors[i].name === radioValue) {
                if ($("#alwaysUse")[0].checked) {
                  choiceStore[ext] = editors[i].editor;
                }
                $("#chooseEditorModal").modal("hide");
                return resolve(editors[i].editor);
              }
            }
          }
          $("#chooseEditorModal").modal("hide");
          return reject(null);

        });
        $("#alwaysUseLabel").html(`Always use this app to open ${ext} fles`)
        $("#chooseEditorModal").modal("show");
      })

    }

    this.chooseEditorByExt = function (editors, ext) {
      return new Promise(async (resolve, reject) => {
        if (!initialized) {
          init(editors)
        }

        try {
          const edt = await self.doChooseEditorByExt(editors, ext);
          resolve(edt)
        } catch (err) {
          reject(err)
        }

      })

    }

    this.getEditorStoredChoice = function (ext){
      return choiceStore[ext] || null;
    }

    this.getEditorByExt = function (editors, ext) {
      return new Promise(async (resolve, reject) => {
        const storedEditor = choiceStore[ext] || null;
        if (storedEditor) {
          return resolve(storedEditor);
        }
        if (!initialized) {
          init(editors)
        }

        let availableEditors = [];
        for (let i = 0; i < editors.length; ++i) {
          const editor = editors[i].editor;
          const exts = editor.getExtensions();
          for (let n = 0; n < exts.length; ++n) {
            if (exts[n] == ext) {
              availableEditors.push(editor);
            }
          }
        }
        if (availableEditors.length == 0) {
          return resolve(null);
        }
        if (availableEditors.length == 1) {
          return resolve(availableEditors[0]);
        }

        /* const storedEditor = choiceStore[ext];
        //console.log("storedEditor: ", storedEditor)
        if (storedEditor !== undefined) {
          return resolve(storedEditor);
        } */

        try {
          const edt = await self.doChooseEditorByExt(editors, ext);
          resolve(edt)
        } catch (err) {
          reject(err)
        }

      })

    }


  }
}

//notepad.show()
