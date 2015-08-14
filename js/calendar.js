/**
* [DEFINATION] 日历控件
* @Author Sisiliu
* @Time 2015/06/04
* @v1.6 修正了二次显示后连选删除按钮的事件绑定
 * v1.7 添加了destroy方法，对该控件进行销毁
*/

var CalendarPicker = (function($) {

    //对外隐藏信息
    var CONST = {

        //NMONTH正常年，LMONTH闰年
        NMONTH: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        LMONTH: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        WEEK: ["日", "一", "二", "三", "四", "五", "六"],

        //状态信息
        STATE: {
            FREE: 1,
            RANGE: 2,
            SINGLE: 3,
            PENDING: 4,
            OCCUPIED: 0
        },

        //当前选项
        MODE: {
            RANGE: true,
            SINGLE: false,
            toggle: function (mode) {
                //mode为0表示连选
                if (mode == 0) {
                    this.RANGE = true;
                    this.SINGLE = false;
                } else {
                    this.RANGE = false;
                    this.SINGLE = true;
                }
            }
        }

    };

    function CalendarPicker(parentNode,option){
        var temp = new Date();
        this.parentNode = parentNode;
        this.option = {
            calendarCount: option.calendarCount || 3,
            years: option.years || 1,
            forbid: option.forbid || true,
            addDays: option.addDays || 2,
            today: option.today || temp
        };

        var TOMO = _getDateFromNow(this.option.today,this.option.addDays);

        this.rangeFirst = {
            firstDate: null,
            firstDom: null,
            rangeDate: []
        };

        this.config = {

            //明天信息
            MONTH: TOMO.getMonth(),
            YEAR: TOMO.getFullYear(),
            DATE: TOMO.getDate(),
            WEEKDAY: TOMO.getDay(),

            //所有数据
            dataCalen: [],

            //当期月份,0表示本月
            curMonth: 0
        };

        //日历记录
        this.record = {
            range: [],         //连选选中的
            single: [],              //单选选中的
            occupied: []            //今天之前和别人选定的
        };

        this.result = {
            range:[],
            single:[]
        };
        this.resultStr ={
            range:null,
            single:null
        }
    }

    /**
     * 渲染日历html框架
     */
    CalendarPicker.prototype.render = function(){

        var html = '<div class="calendarBar">' +
            "<h4>日期选择</h4><hr>" +
            '<div class="range-choice">' +
            '<input type="radio" value="RANGE" checked="checked" name="DATEPICK"/>连选' +
            '<div id="rangeRecord"></div></div>' +
            '<div class="single-choice">' +
            '<input type="radio" value="SINGLE" name="DATEPICK"/>单选' +
            '<p id="singleRecord"></p></div>' +
            '</div>';

        var prevHtml = '<div id="calendarMain" class="calendarMain">' +
            '<table class="calendar-panel">' +
            '<tbody class="sisi"><tr>' +
            '<td valign="top" class="cal-prev">' +
            '<div class="cal-prevmonth" id="prevMonth" sign="prevmonth">' + '</div>' +
            '</td>';
        var nextHtml = '<td valign="top" class="cal-next">' +
            '<div class="cal-nextmonth" id="nextMonth" sign="nextmonth"></div>' +
            '</td>' +
            '</tr></tbody></table></div>';

        var calendarNo = [];
        for (var i = 0; i < this.option.calendarCount; i++) {
            var temp = '<td valign="top" id="calendarNo' + i;
            if (i == this.option.calendarCount - 1) {
                temp += '" class="calender-cell calender-cell-last">';
            } else {
                temp += '" class="calender-cell">';
            }
            calendarNo.push(temp);
        }

        html = html + prevHtml + calendarNo.join("") + nextHtml;
        html = html + '<div class="calendarBtn">' +
        '<a id="addRange" class="a-btn canclbtn">添加</a>' +
        '<a id="cancelRange" class="a-btn canclbtn">取消</a></div>';

        //显示日历的框架
        this.parentNode.html(html);
    };

    /**
     * 根据数据设置日历
     * @param data
     */
    CalendarPicker.prototype.setVal = function(data){

        //清空数据,清除绑定
        this._clear();
        //显示+绑定
        this.show();
        //初始化读来的数据
        this._initData(data);
        this._processData();
        //绘制
        this._drawCalendar(0);
        //更新记录
        this._freshRangeRecord();

    };

    /**
     * 获取日历最后的值
     * @param data
     */
    CalendarPicker.prototype.getVal = function(){

        this.result.range = [];
        this.result.single = [];

        var length = this.record.single.length;
        for (var i = 0; i < length; i++) {
            this.result.single.push(this.record.single[i].getDateString());
        }

        var length = this.record.range.length;
        for(var i=0; i< length; i++){
            var temp = {};
            temp.start = this.record.range[i][0].getDateString();
            temp.end = this.record.range[i][this.record.range[i].length-1].getDateString();
            this.result.range.push(temp);
        }

        this.resultStr.range = JSON.stringify(this.result.range);
        this.resultStr.single = JSON.stringify(this.result.single);

        this._canclTheRange();
        this._freeFirstDate();

    };

    CalendarPicker.prototype.hide = function(){

        this.parentNode.hide();
        //解绑
        $("input[value='RANGE']").off("click");
        $("input[value='SINGLE']").off("click");
        $("#prevMonth").off("click");
        $("#nextMonth").off("click");

    };

    CalendarPicker.prototype.show = function(){
        this.parentNode.show();
        this.bindEvent();
    };

    CalendarPicker.prototype.destroy = function(){
        this.parentNode.off();
        this.parentNode.html("");
        this._clear();
    };

    //初始化原始数据
    CalendarPicker.prototype._initData = function (data) {

        var countMonth = this.option.years * 12;
        //if (this.config.DATE != 1) {
            countMonth += 1;
        //}
        var tempM = this.config.MONTH;
        var tempY = this.config.YEAR;

        //获取perYear
        for (var i = 0; i < countMonth; i++) {

            var perMonth = new OneMonth(tempY, tempM);
            this.config.dataCalen.push(perMonth);

            if (tempM == 11) {
                tempM = 0;
                tempY += 1;
            } else {
                tempM += 1;
            }
        }
        if (this.option.forbid) {
            for (var i = 0; i < this.config.DATE - 1; i++) {
                this.config.dataCalen[0].table.tableBody.content[i].setState(CONST.STATE.OCCUPIED);
                this.config.dataCalen[0].table.tableBody.content[i].setClass();
            }

            //禁止后半段
            var lastCalen = this.config.dataCalen.length-1;
            var length = this.config.dataCalen[lastCalen].table.tableBody.content.length;
            if(this.config.DATE<3){
                for (var i=0;i<length;i++){
                    this.config.dataCalen[lastCalen].table.tableBody.content[i].setState(CONST.STATE.OCCUPIED);
                    this.config.dataCalen[lastCalen].table.tableBody.content[i].setClass();
                }
                lastCalen = lastCalen-1;
                length = this.config.dataCalen[lastCalen].table.tableBody.content.length;
            }
            for(var i=this.option.today.getDate();i<length;i++){
                this.config.dataCalen[lastCalen].table.tableBody.content[i].setState(CONST.STATE.OCCUPIED);
                this.config.dataCalen[lastCalen].table.tableBody.content[i].setClass();
            }
        }
        this._initPreData(data);

    };

    /**
    * 初始化预设的值，存进record中
    */
    CalendarPicker.prototype._initPreData = function (data) {

        if (data.occupied.length != 0) {
            var length = data.occupied.length;
            for (var i = 0; i < length; i++) {
                var temp = this._getOneDayFromString(data.occupied[i], 0);
                if(temp){
                    this.record.occupied.push(temp);
                }

            }
        }
        if (data.single != 0) {
            var length = data.single.length;
            for (var i = 0; i < length; i++) {
                var temp = this._getOneDayFromString(data.single[i], 0);
                if(temp){
                    this.record.single.push(temp);
                }
            }
        }
        if (data.range != 0) {
            var length = data.range.length;
            for (var i = 0; i < length; i++) {
                var start = this._getOneDayFromString(data.range[i].start, 1);
                var end = this._getOneDayFromString(data.range[i].end, 1);
                var temp = this._getOneDayRange(start, end);
                if(temp){
                    this.record.range.push(temp);
                }
            }
        }
    };

    /**
     * 给临时数组中的数据进行处理
     * @private
     */
    CalendarPicker.prototype._processData = function(){

        var length = this.record.occupied.length;
        for (var i = 0; i < length; i++) {
            this.record.occupied[i].setState(CONST.STATE.OCCUPIED);
            this.record.occupied[i].setClass();
        }
        var length = this.record.single.length;
        for (var i = 0; i < length; i++) {
            this.record.single[i].setState(CONST.STATE.SINGLE);
            this.record.single[i].setClass();
        }
        var length = this.record.range.length;
        for (var i = 0; i < length; i++) {
            var rlength = this.record.range[i].length;
            for (var j = 0; j < rlength; j++) {
                this.record.range[i][j].setState(CONST.STATE.RANGE);
                this.record.range[i][j].setClass();
            }
        }
    };

    /**
     * 事件绑定
     */
    CalendarPicker.prototype.bindEvent = function (){

        var that = this;

        $("input[value='RANGE']").off("click");
        $("input[value='SINGLE']").off("click");
        $("#prevMonth").off("click");
        $("#nextMonth").off("click");
        //绑定
        $("input[value='RANGE']").on("click", function () {
            CONST.MODE.toggle(0);
            that._processData();
            that._drawCalendar(0);
            that.bindRangeEvent();
        });
        $("input[value='SINGLE']").on("click", function () {
            that._canclTheRange();
            CONST.MODE.toggle(1);
            that._freeFirstDate(0);
            that._processData();
            that._drawCalendar(0);
            that.bindSingleEvent();
        });
        //前一个月
        $("#prevMonth").on("click", function () {
            that._drawCalendar(-1);
        });
        //后一个月
        $("#nextMonth").on("click", function () {
            that._drawCalendar(+1);
        });
        that.bindRangeEvent();

    };

    /**
     * 连选模式的事件绑定
     */
    CalendarPicker.prototype.bindRangeEvent = function() {

        var that = this;
        //取消单选的事件绑定
        $(".calendar-panel").off("click", ".table-cell-free");
        $(".calendar-panel").off("click", ".table-cell-selected");
        $(".single-choice").off("click", "#singleRecord a");

        //添加连选的事件绑定
        $(".calendar-panel").on("click", ".table-cell-free", function () {
            that._markRange1($(this));
        });

        //连选记录的事件
        $("#rangeRecord").on("click", ".delRange", function () {
            that._delRangeRecord($(this));
            return false;
        });

    };

    /**
     * 单选模式的事件绑定
     */
    CalendarPicker.prototype.bindSingleEvent = function() {

        var that = this;
        //清除绑定
        $(".calendar-panel").off("click", ".table-cell-free");
        $(".calendar-panel").off("click", ".table-cell-selected");
        $("#addRange").off("click");
        $("#rangeRecord").off("click", ".delRange");

        //添加绑定
        $(".calendar-panel").on("click", ".table-cell-free", function () {
            that._markTheDay($(this));
        });
        $(".calendar-panel").on("click", ".table-cell-selected", function () {
            that._delTheDay($(this));
        });
        //计数的事件绑定
        $(".single-choice").on("click", "#singleRecord a", function () {
            that._delAllDays();
        });

    };


    /**
     * 连选的第一步
     * @param dayDom
     * @private
     */
    CalendarPicker.prototype._markRange1 = function(dayDom) {

        var that = this;
        var y = dayDom.attr("y");
        var m = dayDom.attr("m");
        var d = dayDom.attr("d");

        var thisDay = that._getOneDay(y, m, d);
        thisDay.setState(CONST.STATE.PENDING);
        thisDay.setClass();
        dayDom.removeClass("table-cell-free").addClass("table-cell-pending");
        that.rangeFirst.firstDate = thisDay;
        that.rangeFirst.firstDom = dayDom;

        $(".calendar-panel").off("click", ".table-cell-free");

        $(".calendar-panel").on("click", ".table-cell-free", function () {
            that._markRange2($(this));
        });
    };

    /**
     * 连选第二步
     * @param dayDom
     * @private
     */
    CalendarPicker.prototype._markRange2 = function(dayDom) {

        var that = this;

        var y = dayDom.attr("y");
        var m = dayDom.attr("m");
        var d = dayDom.attr("d");

        var sy = that.rangeFirst.firstDate._date.year;
        var sm = that.rangeFirst.firstDate._date.month;
        var sd = that.rangeFirst.firstDate._date.day;

        var endTime = new Date(y, m, d);
        var startTime = new Date(sy, sm, sd);

        that.rangeFirst.rangeDate = that._getOneDayRange(startTime, endTime);

        var length = that.rangeFirst.rangeDate.length;

        for (var i = 0; i < length; i++) {
            //如果间隔别的点
            if (that.rangeFirst.rangeDate[i].getState() == CONST.STATE.OCCUPIED || that.rangeFirst.rangeDate[i].getState() == CONST.STATE.RANGE || that.rangeFirst.rangeDate[i].getState() == CONST.STATE.SINGLE) {
                that._freeFirstDate(0);
                $(".calendar-panel").off("click", ".table-cell-free");
                $(".calendar-panel").on("click", ".table-cell-free", function () {
                    that._markRange1($(this));
                });
                return;
            }
        }

        //如果都可以的话
        that._markTheRange();

        $(".calendar-panel").off("click", ".table-cell-free");

        $(".canclbtn").removeClass("canclbtn").addClass("subbtn");

        $("#addRange").on("click", function () {
            that._addRangeToRecord();
            that._freshRangeRecord();
            that._freeFirstDate(1);
            that._drawCalendar(0);
            $(".calendar-panel").on("click", ".table-cell-free", function () {
                that._markRange1($(this));
            });

        });

        $("#cancelRange").on("click", function () {
            that._canclTheRange();
            that._freeFirstDate(0);
            $(".calendar-panel").on("click", ".table-cell-free", function () {
                that._markRange1($(this));
            });
        });

    };

    /**
     * 标记连选
     * @private
     */
    CalendarPicker.prototype._markTheRange = function() {

        var length = this.rangeFirst.rangeDate.length;
        for (var i = 0; i < length; i++) {
            this.rangeFirst.rangeDate[i].setState(CONST.STATE.PENDING);
            this.rangeFirst.rangeDate[i].setClass();
        }
        this._drawCalendar(0);
    };

    /**
     * 增加一条连选记录
     * @private
     */
    CalendarPicker.prototype._addRangeToRecord = function() {
        var length = this.rangeFirst.rangeDate.length;
        for (var i = 0; i < length; i++) {
            this.rangeFirst.rangeDate[i].setState(CONST.STATE.RANGE);
            this.rangeFirst.rangeDate[i].setClass();
        }
        this.record.range.push(this.rangeFirst.rangeDate);
    };

    /**
     * 删除一条连选记录
     * @param dom
     * @private
     */
    CalendarPicker.prototype._delRangeRecord = function(dom) {
        var index = dom.attr("value");
        var tempRange = this.record.range[index];
        //改变状态
        if(tempRange){
            var length = tempRange.length;
            for (var i = 0; i < length; i++) {
                tempRange[i].setState(CONST.STATE.FREE);
                tempRange[i].setClass();
            }
            //删除记录
            this.record.range.splice(index, 1);
            //重绘日历
            this._drawCalendar(0);
            //更新记录
            this._freshRangeRecord();
        }

    };

    /**
     * 选中某一天
     * @param aDay
     * @private
     */
    CalendarPicker.prototype._markTheDay = function(dayDom) {

        var y = dayDom.attr("y");
        var m = dayDom.attr("m");
        var d = dayDom.attr("d");

        var thisDay = this._getOneDay(y, m, d);

        thisDay.setState(CONST.STATE.SINGLE);
        thisDay.setClass();
        dayDom.removeClass("table-cell-free").addClass("table-cell-selected");
        this.record.single.push(thisDay);
        $("#singleRecord").html("已选择" + this.record.single.length + "天" + "<a> 删除</a>");
    };

    /**
     * 删除某一天
     * @param dayDom
     * @private
     */
    CalendarPicker.prototype._delTheDay = function (dayDom) {

        var y = dayDom.attr("y");
        var m = dayDom.attr("m");
        var d = dayDom.attr("d");

        var thisDay = this._getOneDay(y, m, d);

        thisDay.setState(CONST.STATE.FREE);
        thisDay.setClass();
        dayDom.removeClass("table-cell-selected").addClass("table-cell-free");
        this.record.single.splice($.inArray(thisDay, this.record.single), 1);
        $("#singleRecord").html("已选择" + this.record.single.length + "天" + "<a> 删除</a>");
    };

    /**
     * 删除所有单选
     * @private
     */
    CalendarPicker.prototype._delAllDays = function() {
        var length = this.record.single.length;
        for (var i = 0; i < length; i++) {
            var temp = this.record.single.pop();
            temp.setState(CONST.STATE.FREE);
            temp.setClass();
        }
        $(".table-cell-selected").removeClass("table-cell-selected").addClass("table-cell-free");
        $("#singleRecord").html("已选择" + this.record.single.length + "天" + "<a> 删除</a>");
    }

    //清除所有数据
    CalendarPicker.prototype._clear = function(){

        //所有数据
        this.config.dataCalen=[];

        //当期月份,0表示本月
        this.config.curMonth=0;

        //日历记录
        this.record = {
            range: [],               //连选选中的
            single: [],              //单选选中的
            occupied: []            //今天之前和别人选定的
        };

        CONST.MODE.toggle(0);

        $("input[value='RANGE']").prop("checked",true);

        this.parentNode.off();
        ////解绑所有事件
        //$(".calendar-panel").off("click", "*");
        //
        ////连选记录的事件
        //$("#rangeRecord").off("click", ".delRange");
    };



    /**
     * 绘制每个日历
     * @param id
     * @param countMonth
     * @private
     */
    CalendarPicker.prototype._drawEachCal = function (id, countMonth) {
        var container = $(id);
        container.html(this.config.dataCalen[countMonth].makeHtml());
    };

    /**
     * 根据位移画出所有日历
     * @param offset
     * @private
     */
    CalendarPicker.prototype._drawCalendar = function(offset) {

        var countMonth = this.option.years * 12;
        if (this.config.DATE != 1) {
            countMonth += 1;
        }
        if (this.config.curMonth == 0 && offset == -1) {
            return;
        } else if (this.config.curMonth == countMonth - this.option.calendarCount && offset == 1) {
            return;
        } else {
            this.config.curMonth += offset;
            for (var i = 0; i < this.option.calendarCount; i++) {
                this._drawEachCal("#calendarNo" + i, this.config.curMonth + i);
            }
        }
    };

    /**
     * 每次操作刷新一次已选日期
     * @private
     */
    CalendarPicker.prototype._freshRangeRecord = function(){

        var count = this.record.range.length;
        var html = "";
        for (var i = 0; i < count; i++) {
            var range = this.record.range[i];
            var length = range.length - 1;
            var startTime = range[0].getDateString();
            var endTime =  range[length].getDateString();
            html += "<p>" + startTime + "~" + endTime + '<a href="#" value=' + i + ' class="delRange">' + ' 删除</a></p>';
        }
        $("#rangeRecord").html(html);
        $("#singleRecord").html("已选择" + this.record.single.length + "天" + "<a> 删除</a>");
    };


    /**
     * 清除对第一个元素的绑定
     * 如果tag为0，则取消选择，清空元素1
     * 如果tag为1，则确认选择，不清空元素1
     * @private
     */
    CalendarPicker.prototype._freeFirstDate = function(tag) {
        //删除第一个元素
        if (this.rangeFirst.firstDate && !tag) {
            this.rangeFirst.firstDate.setState(CONST.STATE.FREE);
            this.rangeFirst.firstDate.setClass();
        }
        this.rangeFirst.firstDate = null;
        this._drawCalendar(0);
        this.rangeFirst.firstDom = null;
        this.rangeFirst.rangeDate = [];

        //对添加取消按钮的动作
        $(".subbtn").removeClass("subbtn").addClass("canclbtn");
        $("#addRange").off("click");
        $("#cancelRange").off("click");
    };


    /**
     * 取消连选
     * @private
     */
    CalendarPicker.prototype._canclTheRange=function() {

        var length = this.rangeFirst.rangeDate.length;
        for (var i = 0; i < length; i++) {
            this.rangeFirst.rangeDate[i].setState(CONST.STATE.FREE);
            this.rangeFirst.rangeDate[i].setClass();
        }
        this._drawCalendar(0);
    };

    /**
     * 返回起始日期和终止日期之间的所有OneDay数组
     * @param start
     * @param end
     * @private
     */
    CalendarPicker.prototype._getOneDayRange = function(startTime, endTime) {

        var rangeDays = [];

        var peroid = _getDatePeroid(startTime, endTime);
        if (peroid < 0) {
            for (var i = peroid; i <= 0; i++) {
                var temp = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
                temp.setDate(startTime.getDate() + i);
                temp = this._getOneDay(temp.getFullYear(), temp.getMonth(), temp.getDate());
                if(temp){
                    rangeDays.push(temp);
                }

            }
        } else {
            for (var i = 0; i <= peroid; i++) {
                var temp = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
                temp.setDate(startTime.getDate() + i);
                temp = this._getOneDay(temp.getFullYear(), temp.getMonth(), temp.getDate());
                if(temp){
                    rangeDays.push(temp);
                }
            }
        }
        if(rangeDays.length>0){
            return rangeDays;
        }else{
            return null;
        }

    };


    /**
    * 根据字符串找到OneDay对象，或者日期对象
    * @param str
    * @param mode 如果是0返回对象，如果是1返回日期对象
    * @returns {*}
    * @private
    */
    CalendarPicker.prototype._getOneDayFromString = function(str, mode) {

        if (str != "") {
            y = parseInt(str.substring(0, 4),10);
            m = parseInt(str.substring(5, 7),10) - 1;
            d = parseInt(str.substring(8, 10),10);
            if (mode == 0) {
                return this._getOneDay(y, m, d);
            } else if (mode == 1) {
                return new Date(y, m, d);
            } else {
                return null;
            }
        } else {
            return null;
        }

    };


    /**
    * 根据年月日找到该OneDay对象
    * @param y
    * @param m
    * @param d
    * @returns {*}
    * @private
    */
    CalendarPicker.prototype._getOneDay = function(y, m, d) {

        var index = (y - this.config.YEAR) * 12 + (m - this.config.MONTH);
        if(index<0){
            return null;
        }

        var length = this.config.dataCalen[index].table.tableBody.content.length;

        for (var i = 0; i < length; i++) {
            if ((this.config.dataCalen[index].table.tableBody.content[i]._date.year == y) && (this.config.dataCalen[index].table.tableBody.content[i]._date.month == m) && (this.config.dataCalen[index].table.tableBody.content[i]._date.day == d)) {
                return this.config.dataCalen[index].table.tableBody.content[i];
            }
        }
        return null;
    };


    /**
     * 获取从今天起的某一天
     * @param offSet 偏移量 + 表示明天 - 表示昨天
     * @returns {Date}
     * @private
     */
    function _getDateFromNow(today,offSet) {
        var y=today.getFullYear();
        var m=today.getMonth();
        var d=today.getDate();
        var dd = new Date(y,m,d);
        dd.setDate(dd.getDate() + offSet);//获取AddDayCount天后的日期
        return dd;
    }

    /**
     * 根据年月日，返回是周几
     * @param y
     * @param m
     * @returns {number}
     * @private
     */
    function _getDayByYMD(y, m, d) {
        var dd = new Date(y, m, d);
        return dd.getDay();
    }

    /**
     * 根据年月日，返回是第几周，从0开始
     * @param y
     * @param m
     * @param d
     * @returns {number}
     * @private
     */
    function _getNumOfWeekByYMD(y, m, d) {

        var firstDay = _getDayByYMD(y, m, 1);
        var dayCount = firstDay + d - 1;
        return (dayCount - (dayCount % 7)) / 7;

    }

    /**
     * 计算该月份一共几天
     * @param y
     * @param m
     * @returns {*}
     * @private
     */
    function _getLastDayOfMonth(y, m) {

        if ((y % 4) == 0) {
            if ((y % 100) == 0 && (y % 400) != 0) {
                return CONST.NMONTH[m];
            }
            return CONST.LMONTH[m];
        } else {
            return CONST.NMONTH[m];
        }
    }

    /**
     * 计算两个日期之间相隔多少天
     * @param start
     * @param finish
     * @returns {number}
     */
    function _getDatePeroid(start, finish) {
        return (finish * 1 - start * 1) / 60 / 60 / 1000 / 24;
    }

    /**
     * 返回周日到周一的表头文本
     * @returns {string}
     * @private
     */
    function _getTableHeadHtml() {

        var t = ['<tr>'];//['<tr><td style="background:#fff;" class="'+this.op.weekClass+'"></td>'];
        for (var i = 0; i < 7; i++) {
            t.push('<td>' + CONST.WEEK[i] + '</td>');
        }
        t.push("</tr>");
        return t.join("");
    }

    function _makeNumberString(n){
        if(n<10){
            return ("0"+ n.toString());
        }else{
            return n.toString();
        }
    }

    /**
     * 位置类
     * @param row
     * @param col
     * @constructor
     */
    function Loc(row, col) {
        this.row = row;
        this.col = col;
    }

    /**
     * 一天的类
     * @param y
     * @param m
     * @param d
     * @param firstDay
     * @constructor
     */
    function OneDay(y, m, d) {

        //位置
        var col = _getDayByYMD(y, m, d);
        var row = _getNumOfWeekByYMD(y, m, d);
        this._loc = new Loc(row, col);
        this.html = "";
        //状态
        //日期
        this._date = {
            year: y,
            month: m,
            day: d
        };
        this.setState(CONST.STATE.FREE);
        this.setClass(CONST.MODE);
    }

    /**
     *
     * @param state
     */
    OneDay.prototype.setState = function (state) {
        this._state = state;
    };

    OneDay.prototype.getState = function () {
        return this._state;
    };

    OneDay.prototype.setClass = function () {

        //连选模式
        if (CONST.MODE.RANGE) {
            if (this.getState() == CONST.STATE.OCCUPIED) {
                this._class = "table-cell-occupied";
            } else if (this.getState() == CONST.STATE.SINGLE) {
                this._class = "table-cell-occupied";
            } else if (this.getState() == CONST.STATE.RANGE) {
                this._class = "table-cell-selected";
            } else if (this.getState() == CONST.STATE.FREE) {
                this._class = "table-cell-free";
            } else if (this.getState() == CONST.STATE.PENDING) {
                this._class = "table-cell-pending";
            }
        }
        //单选模式
        else {
            if (this.getState() == CONST.STATE.OCCUPIED) {
                this._class = "table-cell-occupied";
            } else if (this.getState() == CONST.STATE.SINGLE) {
                this._class = "table-cell-selected";
            } else if (this.getState() == CONST.STATE.RANGE) {
                this._class = "table-cell-occupied";
            } else if (this.getState() == CONST.STATE.FREE) {
                this._class = "table-cell-free";
            } else if (this.getState() == CONST.STATE.PENDING) {
                this._class = "table-cell-free";
            }
        }

        if (this._loc.col == 0) {
            this.html = "<tr>";
        } else {
            this.html = "";
        }
        this.html += "<TD class= " + '"' + this.getClass() + '"' + " sign=data y=" + this._date.year + " m=" + this._date.month + " d=" + this._date.day + " >" + this._date.day + "</TD>";
        if (this._loc.col == 6) {
            this.html += "</tr>";
        }


    };

    OneDay.prototype.getClass = function () {
        return this._class;
    };

    OneDay.prototype.getDateString = function(){
        var y = this._date.year.toString();
        var m = _makeNumberString(this._date.month + 1);
        var d = _makeNumberString(this._date.day);
        return y+'-'+m+'-'+d;
    };

    /**
     * 日历类
     * @param y
     * @param m
     * @constructor
     */
    function Calendar(y, m) {

        var firstDay = _getDayByYMD(y, m, 1);
        var lastDay = _getLastDayOfMonth(y, m);

        this.tableFrame = ['<table class="table-main">', '</table>'];
        this.tableHead = '<thead>' + _getTableHeadHtml() + '</thead>';

        var cellsAhead = [];
        var cells = [];
        var cellsHtml = [];
        var cellsAfter = [];

        for (var d = 1; d <= lastDay; d++) {
            var aDay = new OneDay(y, m, d);
            cells.push(aDay);
            cellsHtml.push(aDay.html);
        }

        for (var d = 0; d < firstDay; d++) {
            if (d == 0) {
                cellsAhead.push("<tr>" + "<td class= " + '"table-cell-empty">' + "</td>");
            } else {
                cellsAhead.push("<td class= " + '"table-cell-empty">' + "</td>");
            }
        }

        var leftDays = 7 - (firstDay + lastDay) % 7;
        if (leftDays == 7) leftDays = 0;
        for (var d = 0; d < leftDays; d++) {
            if (d == (leftDays - 1)) {
                cellsAfter.push("<td class= " + '"table-cell-empty">' + "</td>" + "</tr>");
            } else {
                cellsAfter.push("<td class= " + '"table-cell-empty">' + "</td>");
            }
        }

        this.tableBody = {
            headerHtml: cellsAhead,
            content: cells,
            footerHtml: cellsAfter
        }

    }

    /**
     * PerMonth类
     * @param y
     * @param m
     * @constructor
     */
    function OneMonth(y, m) {

        this.title = ['<div class="calendar-title" sign="month" y="' + y + '" m="' + m + '">', y, '年', (m + 1), '月', '</div>'];
        this.table = new Calendar(y, m);

    }

    OneMonth.prototype.makeHtml = function () {

        var length = this.table.tableBody.content.length;
        var contentHtml = "";
        for (var i = 0; i < length; i++) {
            contentHtml += this.table.tableBody.content[i].html;
        }
        return this.title.join("") + this.table.tableFrame[0] + this.table.tableHead + this.table.tableBody.headerHtml.join("") + contentHtml + this.table.tableBody.footerHtml.join("") + this.table.tableFrame[1];
    };

    return CalendarPicker;

})(jQuery);