sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageToast"
], function(Controller, JSONModel, FlattenedDataset, FeedItem, MessageToast) {
	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard2", {
		onInit: function() {
			this.lotModel = new JSONModel({
				results: []
			});
			this.getView().setModel(this.lotModel, "lot");
		},

		onLogout: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
		},

		onNavigateToDashboard3: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard3");
		},

		onBack: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard1");
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantSelect").getSelectedKey();
			var sYear = this.byId("yearSelect").getSelectedKey();
			var sMonth = this.byId("monthSelect").getSelectedKey();

			if (!sPlant) {
				MessageToast.show("Please select a Plant");
				return;
			}

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZQM_INSPECTIONLOT_CDS_CDS/");
			var sPath = "/ZQM_INSPECTIONLOT_CDS(p_plant='" + sPlant + "')/Set";
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
							var matchMonth = !sMonth || (("0" + (date.getMonth() + 1)).slice(-2) === sMonth);

							return matchYear && matchMonth;
						});
					}
					that._updateDashboard(results);
					if (that.byId("chartGrid")) {
						that.byId("chartGrid").setVisible(true);
					}
					if (that.byId("tablePanel")) {
						that.byId("tablePanel").setVisible(true);
					}
				},
				error: function() {
					MessageToast.show("Error retrieving inspection lots.");
				}
			});
		},

		_getInspectionTypeText: function(code) {
			var map = {
				"01": "Incoming Inspection",
				"02": "In-Process Inspection",
				"03": "Final Inspection",
				"04": "Audit",
				"05": "Sample Inspection"
			};
			return map[code] || code || "Unknown";
		},

		_getUnitText: function(code) {
			var map = {
				"EA": "Each",
				"PC": "Piece",
				"KG": "Kilogram",
				"L": "Litre"
			};
			return map[code] || code || "Unknown";
		},

		_getMaterialText: function(code) {
			var map = {
				"FM": "Frame",
				"RG": "Ring",
				"WD": "Washer Disk",
				"BL": "Bolt"
			};
			return map[code] || code || ("Material " + code);
		},

		_updateDashboard: function(results) {
			var inspectionTypes = {};
			var materials = {};
			var units = {};
			var i;

			for (i = 0; i < results.length; i++) {
				var r = results[i];
				r.inspection_type_text = this._getInspectionTypeText(r.inspection_type);
				r.unit_text = this._getUnitText(r.unit);
				r.material_text = this._getMaterialText(r.material_text);

				inspectionTypes[r.inspection_type_text] = true;
				materials[r.material_text] = true;
				units[r.unit_text] = true;
			}

			this.lotModel.setData({
				results: results
			});

			this.byId("kpiTotal").setNumber(results.length);
			this.byId("kpiApproved").setNumber(Object.keys(inspectionTypes).length);
			this.byId("kpiRejected").setNumber(Object.keys(materials).length);
			this.byId("kpiInProgress").setNumber(Object.keys(units).length);

			this._buildSimpleChart(this.byId("chart1"), results, "inspection_type_text", "Lots per Inspection Type", "column");
			this._buildDonut(this.byId("chart2"), results, "material_text", "Lots per Material");
			this._buildLine(this.byId("chart3"), results, "start_date", "Monthly Lot Count");

			// Hide extra charts
			var extraCharts = ["chart4", "chart5", "chart6"];
			for (i = 0; i < extraCharts.length; i++) {
				var c = this.byId(extraCharts[i]);
				if (c) {
					c.setVisible(false);
				}
			}
		},

		_buildSimpleChart: function(oViz, data, groupField, title, chartType) {
			var map = {}, i;
			for (i = 0; i < data.length; i++) {
				var key = data[i][groupField] || "Unknown";
				if (!map[key]) {
					map[key] = { Category: key, Count: 0 };
				}
				map[key].Count++;
			}
			var chartData = [];
			for (var k in map) {
				chartData.push(map[k]);
			}

			oViz.setVizType(chartType);
			oViz.setDataset(new FlattenedDataset({
				dimensions: [{ name: "Category", value: "{Category}" }],
				measures: [{ name: "Count", value: "{Count}" }],
				data: { path: "/" }
			}));
			oViz.setModel(new JSONModel(chartData));
			oViz.setVizProperties({
				title: { text: title, visible: true }
			});
			oViz.removeAllFeeds();
			oViz.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Count"] }));
			oViz.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Category"] }));
		},

		_buildDonut: function(oViz, data, groupField, title) {
			var map = {}, i;
			for (i = 0; i < data.length; i++) {
				var key = data[i][groupField] || "Unknown";
				map[key] = (map[key] || 0) + 1;
			}
			var donutData = [];
			for (var key in map) {
				donutData.push({ label: key, value: map[key] });
			}

			oViz.setVizType("donut");
			oViz.setDataset(new FlattenedDataset({
				dimensions: [{ name: "Material", value: "{label}" }],
				measures: [{ name: "Count", value: "{value}" }],
				data: { path: "/" }
			}));
			oViz.setModel(new JSONModel(donutData));
			oViz.setVizProperties({
				title: { text: title, visible: true }
			});
			oViz.removeAllFeeds();
			oViz.addFeed(new FeedItem({ uid: "size", type: "Measure", values: ["Count"] }));
			oViz.addFeed(new FeedItem({ uid: "color", type: "Dimension", values: ["Material"] }));
		},

		_buildLine: function(oViz, data, dateField, title) {
			var trendMap = {}, i;
			for (i = 0; i < data.length; i++) {
				var d = new Date(data[i][dateField]);
				if (!isNaN(d.getTime())) {
					var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
					trendMap[key] = trendMap[key] ? trendMap[key] + 1 : 1;
				}
			}
			var trendData = [];
			for (var k in trendMap) {
				trendData.push({ Period: k, Count: trendMap[k] });
			}
			trendData.sort(function(a, b) {
				return a.Period > b.Period ? 1 : -1;
			});

			oViz.setVizType("line");
			oViz.setDataset(new FlattenedDataset({
				dimensions: [{ name: "Period", value: "{Period}" }],
				measures: [{ name: "Count", value: "{Count}" }],
				data: { path: "/" }
			}));
			oViz.setModel(new JSONModel(trendData));
			oViz.setVizProperties({
				title: { text: title, visible: true }
			});
			oViz.removeAllFeeds();
			oViz.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: ["Count"] }));
			oViz.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Period"] }));
		}
	});
});
