var APP_TYPE = 'Release';
var START_DATE_NAME = "ReleaseStartDate";
var END_DATE_NAME = "ReleaseDate";
var ESTIMATE_UNIT_NAME = 'ReleaseEstimateUnitName';

function ReleaseScopeChange() {
    var dropdown;
    var wait;
    var prefixes = { 'storyPrefix':null, 'defectPrefix':null, 'defectSuitePrefix':null, 'testSetPrefix':null };
    var planEstimateLabel;
    var timeboxDays;
    var dataAddedOrRemoved;
    var rallyDataSource;

    function dateDiff(date1, date2) {
        return Math.abs(Math.floor(dojo.date.difference(date1, date2)));
    }

    function fromISOString(date, ignoreTime) {
        var newDate = dojo.date.stamp.fromISOString(date.replace(/Z/, ""));
        if (ignoreTime) {
            newDate.setHours(0, 0, 0, 0);
        }
        return newDate;
    }

    function getFormattedId(description) {
        var artifactName = description.split("[");

        if (typeof artifactName[1] === 'undefined') {
            artifactName = description.split(":");
        }

        if (typeof artifactName[1] === 'undefined') {
            return null;
        }

        var formattedID = artifactName[1].split(":");
        formattedID = formattedID[0].replace(/^\s*|\s*$/g, '');

        return formattedID;
    }

    function byDesc(property) {
        return function(o, p) {
            var a,b;
            if (typeof o === 'object' && typeof p === 'object' && o && p) {
                a = o[property];
                b = p[property];
                if (a === b) {
                    return 0;
                }
                if (typeof a === typeof b) {
                    return a < b ? 1 : -1;
                }
                return typeof a < typeof b ? 1 : -1;
            }
        };
    }

    function buildOrFilterArray(artifacts, fieldName, fieldValue) {
        var filterArray = [];
        dojo.forEach(artifacts, function(artifact, i) {
            filterArray.push("" + fieldName + " = " + artifact[fieldValue]);
        });
        return rally.sdk.util.Query.or(filterArray);
    }

    function checkSchedule(description) {
        if (/Unscheduled/.test(description)) {
            return "Removed";
        }

        if (/Scheduled/.test(description)) {
            return "Added";
        }
    }

    function parseScopeRevisions(revisions, timeboxStart, timeboxEnd, prefixes) {
        var storyIds = [];
        var defectIds = [];
        var defectSuiteIds = [];

        function buildIdObject() {
            objId = {
                "FormattedID" : formattedIdOnly,
                "Status" : checkSchedule(splitRevision[num]),
                "PrefixID" : formattedIdWithPrefix,
                "User" : revisions[i].User,
                "CreationDate" : dataDate
            };
            return objId;
        }

        for (var i = 0; i < revisions.length; i++) {
            var dataDate = fromISOString(revisions[i].CreationDate, false);
            var endDate = fromISOString(timeboxEnd, true);
            endDate.setHours(23, 59, 59, 0);

            if (/Scheduled|Unscheduled/.test(revisions[i].Description) &&
                    dataDate >= fromISOString(timeboxStart, true) &&
                    dataDate <= endDate) {

                var splitRevision = revisions[i].Description.split(',');
                for (var num = 0; num < splitRevision.length; num++) {
                    if (/Scheduled|Unscheduled/.test(splitRevision[num])) {

                        var formattedIdWithPrefix = getFormattedId(splitRevision[num]);

                        if (formattedIdWithPrefix !== null) {
                            var formattedIdOnly = formattedIdWithPrefix.replace(/[^0-9]/g, "");

                            if (formattedIdWithPrefix.indexOf(prefixes.testSetPrefix) >= 0) {
                            } else if (formattedIdWithPrefix.indexOf(prefixes.defectSuitePrefix) >= 0) {
                                defectSuiteIds.push(buildIdObject());
                            } else if (formattedIdWithPrefix.indexOf(prefixes.defectPrefix) >= 0) {
                                defectIds.push(buildIdObject());
                            } else if (formattedIdWithPrefix.indexOf(prefixes.storyPrefix) >= 0) {
                                storyIds.push(buildIdObject());
                            }
                        }
                    }
                }
            }
        }

        allWorkProductIds = {
            "storyIds" : storyIds,
            "defectIds" : defectIds,
            "defectSuiteIds" : defectSuiteIds
        };

        return allWorkProductIds;
    }

    function calculateLastDayShown(timeboxDays) {
        var timeboxLength = timeboxDays.length - 1;
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        if (timeboxDays[timeboxLength] <= today) {
            return dateDiff(timeboxDays[0], timeboxDays[timeboxLength]);
        } else {
            return dateDiff(timeboxDays[0], today);
        }
    }

    function createObjectResult(results) {
        var newArr = [];

        for (var i = 0; i < results.length; i++) {
            if (results[i].PlanEstimate === null) {
                newArr[results[i].FormattedID.replace(/[^0-9]/g, "")] = {
                    "ObjectID" : results[i].ObjectID,
                    "PlanEstimate" : 0,
                    "Project" : results[i].Project._refObjectName,
                    "Name" : results[i].Name,
                    "Type" : results[i]._type,
                    "_ref" : results[i]._ref
                };
            } else {
                newArr[results[i].FormattedID.replace(/[^0-9]/g, "")] = {
                    "ObjectID" : results[i].ObjectID,
                    "PlanEstimate" : results[i].PlanEstimate,
                    "Project" : results[i].Project._refObjectName,
                    "Name" : results[i].Name,
                    "Type" : results[i]._type,
                    "_ref" : results[i]._ref
                };
            }
        }
        return newArr;
    }

    function buildWorkProductArr(objectType, ids, artifacts) {
        var workProductArr = [];

        for (var cnt = 0; cnt < ids.length; cnt++) {
            var artifactIndex = ids[cnt].FormattedID;
            var estimate = 0;

            if (typeof artifacts[artifactIndex] === 'undefined') {
                workProductArr[cnt] = {
                    "FormattedID" :  ids[cnt].PrefixID,
                    "PlanEstimate" : estimate,
                    "ObjectID" : 0,
                    "Name" : '<i>' + objectType + ' Deleted</i>',
                    "Project" : '',
                    "CreationDate" : ids[cnt].CreationDate,
                    "User" : ids[cnt].User,
                    "Status" : ids[cnt].Status,
                    "_ref" : ids[cnt]._ref
                };
            } else {
                workProductArr[cnt] = {
                    "FormattedID" :  ids[cnt].PrefixID,
                    "PlanEstimate" : artifacts[artifactIndex].PlanEstimate,
                    "ObjectID" : artifacts[artifactIndex].ObjectID,
                    "Name" : artifacts[artifactIndex].Name,
                    "Project" : artifacts[artifactIndex].Project,
                    "CreationDate" : ids[cnt].CreationDate,
                    "User" : ids[cnt].User,
                    "Status" : ids[cnt].Status,
                    "Type" : artifacts[artifactIndex].Type,
                    "_ref" : artifacts[artifactIndex]._ref
                };
            }
        }
        return workProductArr;

    }

    function getTimeboxDays(timeboxStart, timeboxEnd) {
        var timeboxDays = [];
        timeboxStart = fromISOString(timeboxStart, true);
        timeboxEnd = fromISOString(timeboxEnd, true);
        var dayNumber = 0;
        var dayDate;

        var daysInTimebox = dateDiff(timeboxStart, timeboxEnd) + 1;

        for (var i = 0; i < daysInTimebox; i++) {
            dayDate = new Date(timeboxStart.getTime());
            dayDate.setDate(dayDate.getDate() + i);
            timeboxDays[i] = dayDate;
        }

        return timeboxDays;
    }

    function buildQueryObject(objectType, filter) {
        queryObject = {
            key: objectType,
            type: objectType,
            fetch: 'formattedID,objectID,planEstimate,project,name',
            query: filter,
            order: 'FormattedID',
            project: null
        };

        return queryObject;
    }

    function showAggregateData(added, removed, addedEst, removedEst) {
        var net = added - removed;
        var netEst = addedEst - removedEst;

        dojo.byId('aggregate_data').innerHTML = "";
        dojo.byId('aggregate_data').innerHTML = "<table><tr>" +
                "<td width=20></td><td width=140></td><th width=50 align=left><b>Count</th>" +
                "<th width=100 align=left><b>" + planEstimateLabel + "</b></th>" +
                "<tr><td width=20 align=right><img src='/slm/mashup/1.11/images/plus.gif'></td>" +
                "<th width=140 align=left>   Total Added </th>" +
                "<td width=50 align=left>" + added + "</td>" +
                "<td width=100 align=left>" + addedEst.toFixed(1) +
                "</td></tr><tr><td width=20 align=right><img src='/slm/mashup/1.11/images/minus.gif'></td>" +
                "<th width=140 align=left>   Total Removed </th>" +
                "<td width=50 align=left>" + removed + "</td>" +
                "<td width=100 align=left>" + removedEst.toFixed(1) +
                "</td></tr><tr><td width=20 align=right></td>" +
                "<th width=140 align=left><b>Net </b></th>" +
                "<td width=50 align=left><b>   " + net + "</b></td>" +
                "<td width=100 align=left><b>" + netEst.toFixed(1) + " " +
                "</b></td></tr></table>";
        dojo.byId('aggregate_data').style.visibility = "visible";
    }

    function buildHeader(creationDate) {
        return  "</table><table class='data-table'>" +
                "<tr><th width=150 style='border-bottom: 0px;'><h4>" +
                dojo.date.locale.format(creationDate, {selector:"date",datePattern:"EEEE, MM/dd/yyyy"}) +
                "</h4></th>" + "<td width=20 style='border-bottom: 0px;'></td>" +
                "<th width=60><b>ID</b></th><th width=450><b>Name</b></th>" +
                "<th width=150><b>Project</b></th><th width=50><b>Est</b></th>" +
                "<th width=50><b>User</b></th></tr>";
    }

    function buildDataTable(workProduct, image) {
        var link = new rally.sdk.ui.basic.Link({item: workProduct}).renderToHtml();
        var link2 = new rally.sdk.ui.basic.Link({item: workProduct, text: workProduct.Name}).renderToHtml();

        var imgUrl = "/slm/mashup/1.11/images/";

        return "<tr><td width=60 style='border-bottom: 0px;border-top: 0px'>" +
                "<td width=20 style='border-bottom: 0px;border-top: 0px'>" +
                "<img align='left' src='" + imgUrl +
                image + ".gif' align='right'></img><td width=60>" + link +
                "</td><td width=450>" + link2 +
                "</td><td width=150>" + workProduct.Project +
                "</td><td width=50>" + workProduct.PlanEstimate +
                "</td><td wdith=50>" + workProduct.User._refObjectName + "</td></tr>";
    }

    function computeTotalEstimate(totals) {
        var totalEst = 0;

        for (var ind in totals) {
            if (totals[ind] > 0) {
                totalEst += totals[ind];
            }
        }

        return totalEst;
    }

    function drawTable(newScope) {
        dojo.byId("info_msg").innerHTML = "";
        var results = '';
        var image = '';
        var diff = 0;
        var totalRemoved = 0;
        var totalAdded = 0;
        var totalRemovedEst = {};
        var totalAddedEst = {};
        var tmpDate = new Date();
        var dateCnt = calculateLastDayShown(timeboxDays);
        var filter;

        tmpDate.setYear(2002); //set to some arbituary date
        tmpDate.setHours(0, 0, 0, 0);

        dojo.byId('table_div').innerHTML = results;

        // determine what filter is selected
        var workFilters = ["all_work", "added_work", "removed_work"];
        for (var ind = 0; ind < workFilters.length; ind++) {
            if (dojo.byId(workFilters[ind]).checked) {
                filter = dojo.byId(workFilters[ind]).value;
            }
        }

        results = "<table id='data_table' class='data-table'>";

        for (var i = 0; i < dataAddedOrRemoved.length; i++) {
            var data = dataAddedOrRemoved[i];

            if (data.Status === 'Removed') {
                image = 'minus';
                totalRemoved = totalRemoved + 1;
                totalRemovedEst[data.FormattedID] = data.PlanEstimate;
            } else {
                image = 'plus';
                totalAdded = totalAdded + 1;
                totalAddedEst[data.FormattedID] = data.PlanEstimate;
            }

            // only show data based on filter criteria (e.g. All, Removed, Added)
            if (filter === 'All' || data.Status === filter) {

                var creationDate = data.CreationDate;
                creationDate.setHours(0, 0, 0, 0);

                // first occurrence of revision date
                if (Date.parse(tmpDate) !== Date.parse(creationDate)) {
                    diff = dateDiff(timeboxDays[0], creationDate);


                    results += buildHeader(creationDate);
                    results += buildDataTable(data, image);
                    tmpDate = creationDate;
                    dateCnt = diff - 1; //date desc so need to subtract 1
                } else {
                    results += buildDataTable(data, image);
                    tmpDate = creationDate;
                }
            }
        }

        if (typeof newScope !== 'undefined') {
            totalAddedEst = computeTotalEstimate(totalAddedEst);
            totalRemovedEst = computeTotalEstimate(totalRemovedEst);
            showAggregateData(totalAdded, totalRemoved, totalAddedEst, totalRemovedEst);
        }

        results += "</table>";
        dojo.byId("radios").style.visibility = "visible";
        dojo.byId("table_div").style.visibility = "visible";
        dojo.byId('table_div').innerHTML = results;
    }

    function processError(errorNum) {
        var errorMsg = [];
        errorMsg[0] = "<br>&nbsp;No work added or removed for this " + APP_TYPE.toLowerCase() + ".";
        errorMsg[1] = "<br>&nbsp;" + APP_TYPE + " has not started yet.";

        wait.hide();
        dojo.byId("aggregate_data").style.visibility = "hidden";
        dojo.byId("table_div").style.visibility = "hidden";
        dojo.byId('info_msg').innerHTML = errorMsg[errorNum];
        return null;
    }

    function getWorkProducts(workProductIds, days) {
        var storyIds = workProductIds.storyIds;
        var defectIds = workProductIds.defectIds;
        var defectSuiteIds = workProductIds.defectSuiteIds;
        var workAddedOrRemoved = [];

        function findDefectSuiteCallback(results) {

            if (results.defectSuite.length > 0) {
                var defectSuitesAddedOrRemoved = buildWorkProductArr('Defect Suite', defectSuiteIds, createObjectResult(results.defectSuite));
                workAddedOrRemoved = workAddedOrRemoved.concat(defectSuitesAddedOrRemoved);
            }

            workAddedOrRemoved.sort(byDesc('CreationDate'));
            dataAddedOrRemoved = workAddedOrRemoved; //chart data
            timeboxDays = days;

            var newScope = "true";
            drawTable(newScope);
            wait.hide();
        }

        function findDefectCallback(results) {
            if (results.defect.length > 0) {
                var defectsAddedOrRemoved = buildWorkProductArr('Defect', defectIds, createObjectResult(results.defect));
                workAddedOrRemoved = workAddedOrRemoved.concat(defectsAddedOrRemoved);
            }

            if (defectSuiteIds.length === 0) {
                results = {"defectSuite" : []};
                findDefectSuiteCallback(results);
            } else {
                var filter = buildOrFilterArray(defectSuiteIds, "FormattedID", "FormattedID");
                rallyDataSource.findAll(buildQueryObject('defectSuite', filter), findDefectSuiteCallback);
            }
        }

        function findStoryCallback(results) {
            if (results.hierarchicalRequirement.length > 0) {
                var storiesAddedOrRemoved = buildWorkProductArr('Story', storyIds, createObjectResult(results.hierarchicalRequirement));
                workAddedOrRemoved = workAddedOrRemoved.concat(storiesAddedOrRemoved);
            }

            if (defectIds.length === 0) {
                results = {"defect" : [] };
                findDefectCallback(results);
            } else {
                var filter = buildOrFilterArray(defectIds, "FormattedID", "FormattedID");
                rallyDataSource.findAll(buildQueryObject('defect', filter), findDefectCallback);
            }
        }

        if (storyIds.length === 0 && defectIds.length === 0 && defectSuiteIds.length === 0) {
            processError(0);
            return null;
        }

        if (storyIds.length === 0) {
            results = {"hierarchicalRequirement" : []};
            findStoryCallback(results);
        } else {
            var filter = buildOrFilterArray(storyIds, "FormattedID", "FormattedID");
            rallyDataSource.findAll(buildQueryObject('hierarchicalRequirement', filter), findStoryCallback);
        }

    }

    function displayTimeboxInfo(days) {
        var now = new Date();
        var endDate = timeboxDays[days.length - 1];
        endDate.setHours(23, 59, 59, 0);

        var startEndDate = dojo.date.locale.format(timeboxDays[0], {selector:"date",datePattern:"MM/dd/yyyy"}) + " - " +
                dojo.date.locale.format(timeboxDays[days.length - 1], {selector:"date",datePattern:"MM/dd/yyyy"});

        if (now <= timeboxDays[0]) {
            dojo.byId('timeboxInfo').innerHTML = startEndDate + " (" + timeboxDays.length + " Days, Not Started)";
        } else if (now <= endDate) {
            var dayTxt = "Days";
            var daysLeft = dateDiff(endDate, now) + 1;
            if (daysLeft === 1) {
                dayTxt = "Day";
            }
            dojo.byId('timeboxInfo').innerHTML =
                    startEndDate + " (" + days.length + " Days, " + daysLeft + " " + dayTxt + " remaining)";
        } else {
            dojo.byId('timeboxInfo').innerHTML =
                    startEndDate + " (" + days.length + " Days, Done)";
        }
    }

    function processMainQuery(results) {
        var now = new Date();
        timeboxDays = getTimeboxDays(dropdown.getSelectedStart(),
                dropdown.getSelectedEnd());
        displayTimeboxInfo(timeboxDays);

        // return if start date is in the future
        if (now >= timeboxDays[0]) {
            planEstimateLabel = results.planEstUnit[0][ESTIMATE_UNIT_NAME];
            var workProductIds = parseScopeRevisions(results.timeboxRevisions,
                    dropdown.getSelectedStart(), dropdown.getSelectedEnd(), prefixes);

            getWorkProducts(workProductIds, timeboxDays);
        } else {
            processError(1);
        }
    }

    function runMainQuery() {
        var filter = "((( " + START_DATE_NAME + " = " + dropdown.getSelectedStart() +
                ") AND (" + END_DATE_NAME + " = " + dropdown.getSelectedEnd() +
                ")) AND (Name = " + '\"' + dropdown.getSelectedName() + '\"))';

        var queryObjectArr = [];
        queryObjectArr[0] = {
            key: 'planEstUnit',
            type: 'WorkspaceConfiguration',
            fetch: ESTIMATE_UNIT_NAME
        };
        queryObjectArr[1] = {
            key: '#timeboxOids',
            type: APP_TYPE,
            fetch: 'ObjectID,Name,project,' + START_DATE_NAME + ',' + END_DATE_NAME,
            query: filter,
            order: END_DATE_NAME + ' desc'
        };
        queryObjectArr[2] = {
            key: 'timeboxRevisions',
            placeholder: '${#timeboxOids/revisionhistory/revisions?fetch=creationDate,description,user&order=CreationDate}'
        };

        rallyDataSource.findAll(queryObjectArr, processMainQuery);
    }

    function getTableData() {
        dojo.byId("info_msg").innerHTML = "";
        dojo.byId("aggregate_data").style.visibility = "hidden";
        dojo.byId("table_div").style.visibility = "hidden";
        dojo.byId("radios").style.visibility = "hidden";
        wait.display("wait");

        runMainQuery();
    }

    function processWorkProductPrefixes(results) {
        var workProducts = ['storyPrefix', 'defectPrefix', 'defectSuitePrefix', 'testSetPrefix'];

        // set default for prefixes
        prefixes.storyPrefix = "US";
        prefixes.defectPrefix = "DE";
        prefixes.defectSuitePrefix = "DS";
        prefixes.testSetPrefix = "TS";

        for (var i = 0; i < workProducts.length; i++) {
            if (results[workProducts[i]].length > 0) {
                prefixes[workProducts[i]] = results[workProducts[i]][0].FormattedID.replace(/[0-9]/g, "");
            }
        }

        getTableData();
    }

    function buildPrefixQuery(keyName, objectType) {
        objArr = {
            key: keyName,
            type: objectType,
            fetch: 'formattedID',
            order: 'CreationDate desc',
            pagesize: 1
        };
        return objArr;
    }

    function getWorkProductPrefixes() {
        var queryObjectArr = [];
        queryObjectArr[0] = buildPrefixQuery('storyPrefix', 'hierarchicalrequirement');
        queryObjectArr[1] = buildPrefixQuery('defectPrefix', 'defect');
        queryObjectArr[2] = buildPrefixQuery('defectSuitePrefix', 'defectSuite');
        queryObjectArr[3] = buildPrefixQuery('testSetPrefix', 'testSet');

        rallyDataSource.find(queryObjectArr, processWorkProductPrefixes);
    }

    this.display = function() {
        rally.sdk.ui.AppHeader.showPageTools(true);
        rally.sdk.ui.AppHeader.setHelpTopic("248");

        wait = new rally.sdk.ui.basic.Wait({hideTarget:false});

        rallyDataSource = new rally.sdk.data.RallyDataSource('__WORKSPACE_OID__',
                '__PROJECT_OID__',
                '__PROJECT_SCOPING_UP__',
                '__PROJECT_SCOPING_DOWN__');

        var config = {showLabel: true,
            label: APP_TYPE};
        dropdown = new rally.sdk.ui.ReleaseDropdown(config, rallyDataSource);
        dropdown.display("dropdown", getWorkProductPrefixes);

        dojo.connect(dojo.byId("all_work"), "onclick", drawTable);
        dojo.connect(dojo.byId("added_work"), "onclick", drawTable);
        dojo.connect(dojo.byId("removed_work"), "onclick", drawTable);
    };
}