sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageToast"
], function(Controller, JSONModel, FlattenedDataset, FeedItem, MessageToast) {
	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard1", {

		onInit: function() {
			var oKpiModel = new JSONModel({
				totalLots: 0,
				approved: 0,
				rejected: 0,
				results: []
			});
			this.kpiModel = oKpiModel;
			this.getView().setModel(oKpiModel, "kpi");
		},

		onLogout: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantInput").getValue();
			var sYear = this.byId("yearSelect").getSelectedKey();
			var sMonth = this.byId("monthSelect").getSelectedKey();

			if (!sPlant) {
				MessageToast.show("Please enter a Plant ID");
				return;
			}

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZQM_RESRECORDS_CDS/");
			var sPath = "/ZQM_RESRECORDS(p_plant='" + sPlant + "')/Set";
			var that = this;

			oModel.read(sPath, {
				success: function(oData) {
					var results = oData.results || [];

					if (sYear) {
						results = results.filter(function(item) {
							var rawDate = item.start_date;
							var date = null;

							if (rawDate instanceof Date) {
								date = rawDate;
							} else if (typeof rawDate === "string" || typeof rawDate === "number") {
								date = new Date(rawDate);
							}

							if (!date || isNaN(date.getTime())) return false;

							var matchYear = date.getFullYear().toString() === sYear;
							var matchMonth = !sMonth || (String(date.getMonth() + 1).padStart(2, '0') === sMonth);
							return matchYear && matchMonth;
						});
					}

					var kpi = {
						totalLots: results.length,
						approved: results.filter(function(r) {
							return r.usage_decision === "A";
						}).length,
						rejected: results.filter(function(r) {
							return r.usage_decision === "R";
						}).length,
						results: results
					};

					that.kpiModel.setData(kpi);

					if (that.byId("chartGrid")) {
						that.byId("chartGrid").setVisible(true);
					}
					if (that.byId("tablePanel")) {
						that.byId("tablePanel").setVisible(true);
					}

					that._updateBarChart(results);
					that._updateDonutChart(results);
					that._updateLineChart(results);
				},
				error: function() {
					MessageToast.show("Failed to fetch records.");
				}
			});
		},

	_updateBarChart: function (data) {
    // Mapping of inspection type codes to labels
    var typeLabels = {
        "01": "Goods Receipt",
        "02": "In-Process",
        "03": "Final Inspection",
        "04": "Production",
        "05": "Audit",
        "": "Unknown"
    };

    var grouped = {};

    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var code = item.inspection_type || "";
        var type = typeLabels[code] || "Other";

        if (!grouped[type]) {
            grouped[type] = {
                inspection_type: type,
                Approved: 0,
                Rejected: 0
            };
        }

        if (item.usage_decision === "A") {
            grouped[type].Approved++;
        } else if (item.usage_decision === "R") {
            grouped[type].Rejected++;
        }
    }

    var chartData = [];
    for (var key in grouped) {
        chartData.push(grouped[key]);
    }

    var oViz = this.byId("barChart");

    oViz.setDataset(new FlattenedDataset({
        dimensions: [{
            name: "Inspection Type",
            value: "{inspection_type}"
        }],
        measures: [{
            name: "Approved",
            value: "{Approved}"
        }, {
            name: "Rejected",
            value: "{Rejected}"
        }],
        data: {
            path: "/"
        }
    }));

    oViz.setModel(new JSONModel(chartData));
    oViz.setVizProperties({
        title: {
            text: "Usage Decision by Inspection Type",
            visible: true
        }
    });

    oViz.removeAllFeeds();
    oViz.addFeed(new FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: ["Approved", "Rejected"]
    }));
    oViz.addFeed(new FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: ["Inspection Type"]
    }));
},

_updateDonutChart: function (data) {
    var materialDescriptions = {
        "FG": "Finished Goods",
        "RM": "Raw Material",
        "SFG": "Semi-Finished Goods",
        "PKG": "Packaging Material",
        "SP": "Spare Parts",
        "LAB": "Lab Material",
        "": "Unknown"
    };

    var materialCountMap = {};

    for (var i = 0; i < data.length; i++) {
        var matCode = data[i].material_text || "";
        var mat = materialDescriptions[matCode] || matCode || "Other";

        if (!materialCountMap[mat]) {
            materialCountMap[mat] = 0;
        }
        materialCountMap[mat]++;
    }

    var donutData = [];
    for (var key in materialCountMap) {
        donutData.push({
            label: key,
            value: materialCountMap[key]
        });
    }

    var oViz = this.byId("donutChart");

    oViz.setVizType("donut");
    oViz.setDataset(new FlattenedDataset({
        dimensions: [{
            name: "Material Type",
            value: "{label}"
        }],
        measures: [{
            name: "Count",
            value: "{value}"
        }],
        data: {
            path: "/"
        }
    }));

    oViz.setModel(new JSONModel(donutData));
    oViz.setVizProperties({
        title: {
            text: "Lots by Material Type",
            visible: true
        }
    });

    oViz.removeAllFeeds();
    oViz.addFeed(new FeedItem({
        uid: "size",
        type: "Measure",
        values: ["Count"]
    }));
    oViz.addFeed(new FeedItem({
        uid: "color",
        type: "Dimension",
        values: ["Material Type"]
    }));
},


		_updateLineChart: function(data) {
			var trendMap = {};
			for (var i = 0; i < data.length; i++) {
				var item = data[i];
				var rawDate = item.start_date;
				var date = null;

				if (rawDate instanceof Date) {
					date = rawDate;
				} else if (typeof rawDate === "string" || typeof rawDate === "number") {
					date = new Date(rawDate);
				}

				if (!date || isNaN(date.getTime())) continue;

				var key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0');

				if (!trendMap[key]) {
					trendMap[key] = 0;
				}
				trendMap[key]++;
			}

			var trendData = [];
			var keys = Object.keys(trendMap).sort();
			for (var j = 0; j < keys.length; j++) {
				trendData.push({
					Period: keys[j],
					Count: trendMap[keys[j]]
				});
			}

			var oViz = this.byId("lineChart");

			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Period",
					value: "{Period}"
				}],
				measures: [{
					name: "Count",
					value: "{Count}"
				}],
				data: {
					path: "/"
				}
			}));
			oViz.setVizProperties({
				title: {
					text: "Monthly Result Entry Trend",
					visible: true
				}
			});
			oViz.setModel(new JSONModel(trendData));
			oViz.removeAllFeeds();
			oViz.addFeed(new FeedItem({
				uid: "valueAxis",
				type: "Measure",
				values: ["Count"]
			}));
			oViz.addFeed(new FeedItem({
				uid: "categoryAxis",
				type: "Dimension",
				values: ["Period"]
			}));
		}

	});
});