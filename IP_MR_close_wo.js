/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * Module Description:
 *
 * Map/Reduce Script on Work Orders.
 * Try to close the valid Work Orders listed by the main saved search.
 *
 * Version	      Date			    Author				 Project/Ticket Number		           Remarks
 *   1.0		  24 Apr 2019	  	Ivan Posadas		      ENHC-0000000      		      Initial Release
 */
define([
  "N/log",
  "N/search",
  "N/runtime",
  "N/record",
  "N/file",
  "N/email"
], function(log, search, runtime, record, file, email) {
  var objCurrentScript = runtime.getCurrentScript();

  var NSUtil = {
    /**
     * Get all of the results from the search even if the results are more than 1000.
     * @param {String} stRecordType - the record type where the search will be executed.
     * @param {String} stSearchId - the search id of the saved search that will be used.
     * @param {nlobjSearchFilter[]} arrSearchFilter - array of nlobjSearchFilter objects.
     * 			The search filters to be used or will be added to the saved search if search id was passed.
     * @param {nlobjSearchColumn[]} arrSearchColumn - array of nlobjSearchColumn objects.
     * 			The columns to be returned or will be added to the saved search if search id was passed.
     * @returns {nlobjSearchResult[]} - an array of nlobjSearchResult objects
     * @author memeremilla - initial version
     * @author gmanarang - used concat when combining the search result
     */
    search: function(
      stRecordType,
      stSearchId,
      arrSearchFilter,
      arrSearchColumn
    ) {
      if (stRecordType == null && stSearchId == null) {
        throw {
          name: "SSS_MISSING_REQD_ARGUMENT",
          message:
            "Missing a required argument. Either stRecordType or stSearchId should be provided.",
          notifyOff: false
        };
      }

      var arrReturnSearchResults = [];
      var objSavedSearch;

      var maxResults = 1000;

      if (stSearchId != null) {
        objSavedSearch = search.load({
          id: stSearchId
        });

        // add search filter if one is passed
        if (arrSearchFilter != null) {
          if (
            arrSearchFilter[0] instanceof Array ||
            typeof arrSearchFilter[0] == "string"
          ) {
            objSavedSearch.filterExpression = objSavedSearch.filterExpression.concat(
              arrSearchFilter
            );
          } else {
            objSavedSearch.filters = objSavedSearch.filters.concat(
              arrSearchFilter
            );
          }
        }

        // add search column if one is passed
        if (arrSearchColumn != null) {
          objSavedSearch.columns = objSavedSearch.columns.concat(
            arrSearchColumn
          );
        }
      } else {
        objSavedSearch = search.create({
          type: stRecordType
        });

        // add search filter if one is passed
        if (arrSearchFilter != null) {
          if (
            arrSearchFilter[0] instanceof Array ||
            typeof arrSearchFilter[0] == "string"
          ) {
            objSavedSearch.filterExpression = arrSearchFilter;
          } else {
            objSavedSearch.filters = arrSearchFilter;
          }
        }

        // add search column if one is passed
        if (arrSearchColumn != null) {
          objSavedSearch.columns = arrSearchColumn;
        }
      }

      var objResultset = objSavedSearch.run();
      var intSearchIndex = 0;
      var arrResultSlice = null;
      do {
        arrResultSlice = objResultset.getRange(
          intSearchIndex,
          intSearchIndex + maxResults
        );
        if (arrResultSlice == null) {
          break;
        }

        arrReturnSearchResults = arrReturnSearchResults.concat(arrResultSlice);
        intSearchIndex = arrReturnSearchResults.length;
      } while (arrResultSlice.length >= maxResults);

      log.debug({
        title: "DC Debug: Search",
        details: JSON.stringify(arrReturnSearchResults)
      });

      return arrReturnSearchResults;
    }
  };

  function isOnErrorStage(summary) {
    handleErrorInStage("Map", summary.mapSummary);
    handleErrorInStage("Reduce", summary.reduceSummary);
    if (summary.inputSummary.error) {
      log.error({
        title: "isOnErrorStage>input: Error",
        details: JSON.stringify(summary.inputSummary.error)
      });
    }
  }

  function handleErrorInStage(stage, summary) {
    summary.errors.iterator().each(function(key, value) {
      log.error({
        title: "isOnErrorStage>" + stage + ": Error",
        details: value
      });
      log.error({
        title: "isOnErrorStage>" + stage + ": Error",
        details: JSON.parse(value).message
      });
      return true;
    });
  }

  function sendReport(arrAttachment, objSummary) {
    log.debug({ title: "sendReport", details: "** Start **" });
    var intUser_ID = objCurrentScript.getParameter(
      "custscript_mr_close_auditor"
    );
    if (intUser_ID) {
      var stUser_NAME = search.lookupFields({
        type: search.Type.EMPLOYEE,
        id: intUser_ID,
        columns: "entityid"
      }).entityid;

      var intNumSummaryCSV = arrAttachment.length;
      for (var intIndex in arrAttachment) {
        email.send({
          author: intUser_ID,
          recipients: intUser_ID,
          subject: "Netsuite System: Work Order auto-closed summary",
          body:
            "Hi " +
            stUser_NAME +
            "!" +
            "<BR><BR>Summary:" +
            "<BR><BR>&nbsp;&nbsp;- Closed Work Orders #: " +
            objSummary.closed +
            "<BR>&nbsp;&nbsp;- Issues found #: " +
            objSummary.error +
            "<BR><BR>Please review the details on the attached document." +
            "<BR><BR>Best regards,<BR><BR>Netsuite System" +
            "<BR><BR><BR>" +
            (parseInt(intIndex) + 1) +
            " of " +
            intNumSummaryCSV,
          attachments: [arrAttachment[intIndex]]
        });
      }
    }
  }

  /**
   * Marks the beginning of the Map/Reduce process and generates input data.
   *
   * @typedef {Object} ObjectRef
   * @property {number} id - Internal ID of the record instance
   * @property {string} type - Record type id
   *
   * @return {Array|Object|Search|RecordRef} inputSummary
   * @since 2015.1
   */
  function getInputData() {
    var stSearch_NAME = objCurrentScript.getParameter(
      "custscript_mr_close_wo_list_search"
    );
    var arrSearchResults = NSUtil.search(null, stSearch_NAME, null, null);
    var arrWOToClose = [];
    arrSearchResults.forEach(function(objResult) {
      var intWO_ID = Number(objResult.getValue(objResult.columns[0]));
      if (!isNaN(intWO_ID) && arrWOToClose.indexOf(intWO_ID) < 0) {
        arrWOToClose.push(intWO_ID);
      }
    });
    log.audit({
      title: "WO to process",
      details: arrWOToClose.length
    });
    log.audit({
      title: "input:GU",
      details: objCurrentScript.getRemainingUsage()
    });

    return arrWOToClose;
  }

  /**
   * Executes when the map entry point is triggered and applies to each key/value pair.
   *
   * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
   * @since 2015.1
   */
  function map(context) {
    log.debug({
      title: "map",
      details: "Start"
    });
    log.debug({
      title: "map: input data",
      details: JSON.stringify(context)
    });
    var intWorkOrder_ID = context.value;
    var recWorkOrder = record.load({
      type: record.Type.WORK_ORDER,
      id: intWorkOrder_ID,
      isDynamic: false
    });

    var stTransaction_ID = recWorkOrder.getValue({
      fieldId: "tranid"
    });

    var blIsFullBuild = true;
    var stCloseMessage = "";
    var intLineCount = recWorkOrder.getLineCount({
      sublistId: "item"
    });

    for (var intIndex = 0; intIndex < intLineCount; intIndex++) {
      var flQuantity = recWorkOrder.getSublistValue({
        sublistId: "item",
        fieldId: "origassemblyqty",
        line: intIndex
      });
      var flQuantityBuild = recWorkOrder.getSublistValue({
        sublistId: "item",
        fieldId: "quantityfulfilled",
        line: intIndex
      });
      var stType = recWorkOrder.getSublistValue({
        sublistId: "item",
        fieldId: "itemtype",
        line: intIndex
      });
      if (stType == "Assembly" && flQuantityBuild != flQuantity) {
        log.debug({
          title: "Line " + intIndex + " O-B WO: " + stTransaction_ID,
          details: flQuantity + "-" + flQuantityBuild
        });
        blIsFullBuild = false;
        break;
      }
    }

    if (blIsFullBuild) {
      try {
        var recWorkOrderClose = record.transform({
          fromType: record.Type.WORK_ORDER,
          fromId: intWorkOrder_ID,
          toType: record.Type.WORK_ORDER_CLOSE,
          isDynamic: false
        });
        recWorkOrderClose.save({
          enableSourcing: true,
          ignoreMandatoryFields: false
        });
        stCloseMessage = "Successfully closed.";
      } catch (e) {
        log.error({
          title: "WOC creation error",
          details: JSON.stringify(e)
        });
        blIsFullBuild = false;
        stCloseMessage = e.message;
      }
    } else {
      stCloseMessage =
        "Difference between Build and Planned quantities on the work order lines.";
    }

    context.write({
      key: blIsFullBuild
        ? "WORK_ORDER_CLOSED_SUCCESS"
        : "WORK_ORDER_CLOSED_ERROR",
      value: {
        workorder: stTransaction_ID,
        message: stCloseMessage
      }
    });

    log.audit({
      title: "map:GU",
      details: objCurrentScript.getRemainingUsage()
    });
  }

  /**
   * Executes when the reduce entry point is triggered and applies to each group.
   *
   * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
   * @since 2015.1
   */
  function reduce(context) {
    log.debug({
      title: "reduce",
      details: "Start"
    });
    log.debug({
      title: "reduce: data",
      details: JSON.stringify(context)
    });

    context.write({
      key: context.key,
      value: {
        quantity: context.values.length,
        data: context.values
      }
    });
  }

  /**
   * Executes when the summarize entry point is triggered and applies to the result set.
   *
   * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
   * @since 2015.1
   */
  function summarize(summary) {
    log.debug({
      title: "summarize",
      details: "Start"
    });
    var stHeaders = "Work Order #,Closed,Message\n";
    var objSummaryCSVFile = file.create({
      name: "Summary_WO_Close.csv",
      contents: stHeaders,
      fileType: "CSV"
    });

    var intNumberSeq = 1;
    var arrAttachment = [];
    var objSummary = { closed: 0, error: 0 };
    summary.output.iterator().each(function(key, value) {
      log.debug({
        title: "summarize:value",
        details: value
      });
      var objResult = JSON.parse(value);
      var blIsClosed = key == "WORK_ORDER_CLOSED_SUCCESS" ? "Yes" : "No";
      if (key == "WORK_ORDER_CLOSED_SUCCESS") {
        objSummary.closed = objResult.quantity;
      } else {
        objSummary.error = objResult.quantity;
      }
      for (var intIndex in objResult.data) {
        var objLine = JSON.parse(objResult.data[intIndex]);
        objSummaryCSVFile.appendLine({
          value: objLine.workorder + "," + blIsClosed + "," + objLine.message
        });

        if (objSummaryCSVFile.size > 9500000) {
          log.audit("Main file size " + intNumberSeq, objSummaryCSVFile.size);
          objSummaryCSVFile.name = "Summary_WO_Close_" + intNumberSeq + ".csv";
          arrAttachment.push(objSummaryCSVFile);
          intNumberSeq++;
          objSummaryCSVFile = file.create({
            name: "Summary_WO_Close_" + intNumberSeq + ".csv",
            contents: stHeaders,
            fileType: "CSV"
          });
        }
      }

      return true;
    });

    arrAttachment.push(objSummaryCSVFile);
    sendReport(arrAttachment, objSummary);

    isOnErrorStage(summary);
    var stType = summary.toString();
    log.audit(stType + " Usage Consumed", summary.usage);
    log.audit(stType + " Concurrency Number ", summary.concurrency);
    log.audit(stType + " Number of Yields", summary.yields);

    log.audit({
      title: "summarize:GU",
      details: objCurrentScript.getRemainingUsage()
    });
  }

  return {
    getInputData: getInputData,
    reduce: reduce,
    map: map,
    summarize: summarize
  };
});
