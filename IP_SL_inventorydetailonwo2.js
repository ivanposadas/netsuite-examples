/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Module Description:
 *
 * User Event script on Work Order.
 * Set the inventory detail value to print on PDF BOM showing all bin numbers where there are items on hand
 *
 * Version	     Date			    Author				 Project/Ticket Number		        Remarks
 * 1.0		  01 Jun 2017		Ivan Posadas		       ENHC-0000000				     Initial Release
 */
define(['N/log','N/record','N/search'],

function(log,record,search) {

    function createInventoryDetailFull(item){
      try{
        //look for Bins whith quantity on hang greater than 0
          var itemSearchObj = search.create({
             type: "item",
             filters: [
                ["name","is",item],
                "AND",
                ["binonhand.quantityonhand","greaterthan","0"]
             ],
             columns: [
                search.createColumn({
                   name: "binnumber",
                   join: "binOnHand",
                   summary: "GROUP",
                   sort: search.Sort.ASC
                }),
                search.createColumn({
                   name: "quantityonhand",
                   join: "binOnHand",
                   summary: "SUM"
                }),
                search.createColumn({
                   name: "quantityavailable",
                   join: "binOnHand",
                   summary: "SUM"
                })
             ]
          });

          var binNumber;
          var quantityavailable;
          var inventoryDString="";

          var searchResultCount = itemSearchObj.runPaged().count;
          itemSearchObj.run().each(function(result){
             // .run().each has a limit of 4,000 results
             //get bin number and quantity available on hand
             binnumber = result.getText ({name:"binnumber",join:"binOnHand",summary:"GROUP"});
             quantityavailable = result.getValue({name:"quantityavailable",join:"binOnHand",summary:"SUM"});

             //buikd a string with the [binnumber(quantityavailable)]
             inventoryDString += binnumber + "(" + quantityavailable + ")\n";

             return true;
          });

          //return [binnumber(quantityavailable)] string
          return inventoryDString;
        }
        catch(e)
        {
          log.error({title:'WO remaining production issue',details: e});
        }

    }

    function createInventoryDetailFullAss(item){
      try{
        //look for Bins whith quantity on hang greater than 0
          var itemSearchObj = search.create({
             type: "item",
             filters: [
                ["name","is",item],
                "AND",
                ["binonhand.quantityonhand","greaterthan","0"]
             ],
             columns: [
                search.createColumn({
                   name: "binnumber",
                   join: "binOnHand",
                   summary: "GROUP",
                   sort: search.Sort.ASC
                }),
                search.createColumn({
                   name: "quantityonhand",
                   join: "binOnHand",
                   summary: "SUM"
                }),
                search.createColumn({
                   name: "quantityavailable",
                   join: "binOnHand",
                   summary: "SUM"
                })
             ]
          });

          var binNumber;
          var quantityavailable;
          var inventoryDString="";

          var searchResultCount = itemSearchObj.runPaged().count;
          itemSearchObj.run().each(function(result){
             // .run().each has a limit of 4,000 results
             //get bin number and quantity available on hand
             binnumber = result.getText ({name:"binnumber",join:"binOnHand",summary:"GROUP"});
             quantityavailable = result.getValue({name:"quantityavailable",join:"binOnHand",summary:"SUM"});

             //buikd a string with the [binnumber(quantityavailable)]
             if("Assy_Plant_Floor" == binnumber)inventoryDString += binnumber + "(" + quantityavailable + ")\n";

             return true;
          });

          //return [binnumber(quantityavailable)] string
          return inventoryDString;
        }
        catch(e)
        {
          log.error({title:'WO remaining production issue',details: e});
        }

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
    	try{
	    	//Get the current work order
	      var wo = scriptContext.newRecord;

        //get the line count from sublist item
        var sublistCountLine = wo.getLineCount({
            sublistId: 'item'
        });

        //for each line get and  add the strig [binnumber(quantityavailable)]
        for(var i = 0;i<sublistCountLine;i++)
        {

          var item = wo.getSublistValue({
              sublistId: 'item',
              fieldId: 'item_display',
              line: i
          });

          //Set the data on inventory detail field
          var sublistValue = wo.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_fullinventorydetail',
              line: i,
              value: createInventoryDetailFull(item)
          });

          //Set the data on inventory detail field
          var sublistValue = wo.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_assembly_bin_quantity',
              line: i,
              value: createInventoryDetailFullAss(item)
          });
        }

    	}
    	catch(e){
    		log.error({title:'WO inventory detail full issue',details: e});
    	}

    }

    return {
        beforeLoad: beforeLoad
    };

});
