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
				results: []
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
			var sPlant = this.byId("plantInputUD").getValue();
			var sYear = this.byId("yearSelectUD").getSelectedKey();
			var sMonth = this.byId("monthSelectUD").getSelectedKey();

			if (!sPlant) {
				MessageToast.show("Please enter Plant ID");
				return;
			}

			var sPath = "/ZQM_USAGEDEF?$filter=plant eq '" + sPlant + "'";
			var oModel = new ODataModel("/sap/opu/odata/sap/ZQM_USAGEDEF_CDS/");
			var that = this;

			oModel.read(sPath, {
				success: function(oData) {
					var results = oData.results || [];
					console.log("Raw OData results:", results);

					// TEMPORARILY skip filtering for testing
					var filtered = results;

					that._updateDashboard(filtered);
				},
				error: function() {
					MessageToast.show("Error retrieving usage decision data.");
				}
			});
		},

		_updateDashboard: function(results) {
			var approved = results.filter(function(r) {
				return r.measured_value === "A";
			}).length;

			var rejected = results.filter(function(r) {
				return r.measured_value === "R";
			}).length;

			var total = results.length;

			this.udModel.setData({
				total: total,
				approved: approved,
				rejected: rejected,
				results: results
			});

			this.byId("kpiTotalUD").setNumber(total);
			this.byId("kpiApprovedUD").setNumber(approved);
			this.byId("kpiRejectedUD").setNumber(rejected);

			this._buildChart(this.byId("udChart1"), results, "inspection_type", "Usage Decision by Type");
			this._buildChart(this.byId("udChart2"), results, "material", "Usage by Material");
			this._buildChart(this.byId("udChart3"), results, "object_type", "Usage by Object Type");
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
						Approved: 0,
						Rejected: 0
					};
				}
				if (item.measured_value === "A") map[key].Approved++;
				else if (item.measured_value === "R") map[key].Rejected++;
			});

			var chartData = Object.keys(map).map(function(key) {
				return {
					label: key,
					Approved: map[key].Approved,
					Rejected: map[key].Rejected
				};
			});

			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Category",
					value: "{label}"
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
					text: title,
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
				values: ["Category"]
			}));
		}
	});
});