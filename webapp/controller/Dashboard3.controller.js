sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageToast"
], function(Controller, JSONModel, ODataModel, FlattenedDataset, FeedItem, MessageToast) {
	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard3", {
		onInit: function() {
			this.udModel = new JSONModel({
				results: [],
				total: 0,
				approved: 0,
				rejected: 0
			});
			this.getView().setModel(this.udModel, "ud");
		},

		onBack: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("Dashboard2");
		},

		onLogout: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantSelect").getSelectedKey();
			if (!sPlant) {
				MessageToast.show("Please enter Plant ID");
				return;
			}

			var sPath = "/ZQM_USAGEDEF_V2(p_plant='" + sPlant + "')/Set";
			var oModel = new ODataModel("/sap/opu/odata/sap/ZQM_USAGEDEF_V2_CDS/");
			var that = this;

			oModel.read(sPath, {
				success: function(oData) {
					var results = oData.results || [];
					//console.log("usage Decision Results:", results);
					that._updateDashboard(results);
				},
				error: function() {
					MessageToast.show("Error retrieving usage decision data.");
				}
			});
		},

		_updateDashboard: function(results) {
			var total = results.length;
			var approved = results.filter(function(r) {
				return r.usage_decision_text === "Accepted";
			}).length;
			var rejected = results.filter(function(r) {
				return r.usage_decision_text === "Rejected";
			}).length;

			this.udModel.setData({
				results: results,
				total: total,
				approved: approved,
				rejected: rejected
			});

			this.byId("kpiTotalUD").setNumber(total);
			this.byId("kpiApprovedUD").setNumber(approved);
			this.byId("kpiRejectedUD").setNumber(rejected);

			this._buildChart(this.byId("udChart1"), results, "inspection_type", "Usage Decision by Inspection Type");
			this._buildChart(this.byId("udChart2"), results, "material", "Usage Decision by Material");
			this._buildChart(this.byId("udChart3"), results, "status", "Usage Decision by Status");
		},

		_buildChart: function(oViz, data, groupField, title) {
			if (!data.length) {
				oViz.setModel(new JSONModel([]));
				oViz.setDataset(null);
				return;
			}

			var map = {};
			data.forEach(function(item) {
				var key = item[groupField] || "Unknown";
				if (!map[key]) {
					map[key] = {
						Accepted: 0,
						Rejected: 0
					};
				}
				if (item.usage_decision_text === "Accepted") map[key].Accepted++;
				else if (item.usage_decision_text === "Rejected") map[key].Rejected++;
			});

			var chartData = Object.keys(map).map(function(key) {
				return {
					label: key,
					Accepted: map[key].Accepted,
					Rejected: map[key].Rejected
				};
			});

			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Category",
					value: "{label}"
				}],
				measures: [{
					name: "Accepted",
					value: "{Accepted}"
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
					text: title,
					visible: true
				}
			});
			oViz.removeAllFeeds();
			oViz.addFeed(new FeedItem({
				uid: "valueAxis",
				type: "Measure",
				values: ["Accepted", "Rejected"]
			}));
			oViz.addFeed(new FeedItem({
				uid: "categoryAxis",
				type: "Dimension",
				values: ["Category"]
			}));
		}
	});
});