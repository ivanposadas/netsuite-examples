/**
 * Task          Date            Author                                                 Remarks
 * DT-example    31 Jul 2020     Ivan Posadas <ivanmposadas@gmail.com>.                 - Init
 * 
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 * @NScriptPortletType Form
 */
define(['N/search', 'N/log', 'N/runtime', './lib_commission_report'], function (search, log, runtime, libraryCR) {

    function render(params) {
        try {
            log.debug({
                title: 'Portlet Params',
                details: JSON.stringify(params)
            });
            var employee = runtime.getCurrentUser().id;
            var subsidiary = runtime.getCurrentUser().subsidiary;
            var portlet = params.portlet;

            var numLines = params.column == 2 ? 12 : 5;
            /*
            [
              {
                month: 'Jan 2020',
                sale: '$ 20.34',
                commission: '$ 0.74',
                link: '<a href="#">Link</a>'
              }
            ]
            */
            var commisions = libraryCR.getCommissionByEmployee(employee, subsidiary, numLines);

            portlet.title = "Commission Report";
            
            portlet.addColumn({
                id: 'month',
                type: 'text',
                label: 'Month',
                align: 'LEFT'
            });
            portlet.addColumn({
                id: 'sale',
                type: 'text',
                label: 'Sales Amount',
                align: 'LEFT'
            });
            portlet.addColumn({
                id: 'commission',
                type: 'text',
                label: 'Commission',
                align: 'LEFT'
            });
            portlet.addColumn({
                id: 'link',
                type: 'text',
                label: 'Detail',
                align: 'LEFT'
            });

            portlet.addRows({
                rows: commisions
            });
        } catch (error) {
            log.error({
                title: 'Portlet: Error',
                details: error
            });
        }
    }

    return {
        render: render
    }
});
