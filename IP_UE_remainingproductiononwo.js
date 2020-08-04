/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Module Description:
 *
 * User Event script on Work Order.
 * Set the remaining production field on work order when the user enter to work order (the field does not store the value).
 *
 * Version	    Date			Author				Project/Ticket Number	                       Remarks
 * 1.0		16 May 2017		Ivan Posadas	     	    ENHC-0000000				        	Initial Release
 */
define(['N/log','N/record'],

function(log,record) {

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
        if(scriptContext.type === scriptContext.UserEventType.VIEW){
  	    	//Get the current work order
  	    	var wo = scriptContext.newRecord;

  	    	//Calculate the remaining production
  	    	var woremaining = wo.getValue('quantity') - wo.getValue('built');

      		//Set the remaingin production to [c..._n..._r...] field
      		wo.setValue({
      		    fieldId: 'custbody_ns_remainingproduction',
      		    value: woremaining
      		});
        }
    	}
    	catch(e){
    		log.error({title:'WO remaining production issue',details: e});
    	}


    }

    return {
        beforeLoad: beforeLoad
    };

});
