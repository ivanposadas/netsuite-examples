/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * Module Description:
 *
 * Map/Reduce Script on Work Orders.
 * Delete work orders in Planned status without child records.
 *
 * Version	     Date			    Author				 Project/Ticket Number		           Remarks
 * 1.0		   06 May 2019		Ivan Posadas		      ENHC-0000000		              Initial Release
 */
define(["N/search", "N/record", "N/runtime"], function(
  search,
  record,
  runtime
) {
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
        title: "isOnErrorStage> value" + stage + ": Error",
        details: value
      });
      log.error({
        title: "isOnErrorStage> message" + stage + ": Error",
        details: JSON.parse(value).message
      });
      return true;
    });
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
      "custscript_mr_delete_wo_search_ids"
    );

    var arrSearchResults = NSUtil.search(null, stSearch_NAME, null, null);
    var arrWOToDelete = [];

    arrSearchResults.forEach(function(objResult) {
      var intWO_ID = Number(objResult.getValue(objResult.columns[0]));
      if (!isNaN(intWO_ID) && arrWOToDelete.indexOf(intWO_ID) < 0) {
        arrWOToDelete.push(intWO_ID);
      }
    });

    log.audit({
      title: "WO to process",
      details: arrWOToDelete.length
    });
    log.audit({
      title: "input:GU",
      details: objCurrentScript.getRemainingUsage()
    });

    return arrWOToDelete;
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

    var recWO = record.load({
      type: record.Type.WORK_ORDER,
      id: context.value,
      isDynamic: false
    });

    var stStatus = recWO.getValue({ fieldId: "orderstatus" });

    //Planned status
    if (stStatus == "A") {
      context.write({
        key: context.value,
        value: 1
      });
    }

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

    record.delete({ type: record.Type.WORK_ORDER, id: context.key });

    log.audit({
      title: "reduce:GU",
      details: objCurrentScript.getRemainingUsage()
    });
  }

  /**
   * Executes when the summarize entry point is triggered and applies to the result set.
   *
   * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
   * @since 2015.1
   */
  function summarize(summary) {
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
    map: map,
    reduce: reduce,
    summarize: summarize
  };
});
