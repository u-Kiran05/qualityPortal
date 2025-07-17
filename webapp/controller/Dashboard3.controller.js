sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/viz/ui5/controls/VizTooltip",
	"sap/m/MessageToast",
	"sap/m/MessageBox" 
], function(Controller, JSONModel, ODataModel, FlattenedDataset, FeedItem, VizTooltip, MessageToast, MessageBox) {

	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard3", {

		onInit: function() {
			this.udModel = new JSONModel({
				results: [],
				pagedResults: [],
				currentPage: 1,
				pageSize: 10,
				totalPages: 1,
				total: 0,
				approved: 0,
				rejected: 0
			});
			this.getView().setModel(this.udModel, "ud");
		},

		onBack: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View2");
		},

		onLogout: function() {
			sap.m.MessageBox.confirm("Are you sure you want to logout?", {
				title: "Confirm Logout",
				icon: sap.m.MessageBox.Icon.QUESTION,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				emphasizedAction: sap.m.MessageBox.Action.YES,
				onClose: function(oAction) {
					if (oAction === sap.m.MessageBox.Action.YES) {
						sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
					}
				}.bind(this)
			});
		},

		onPrevPage: function() {
			var model = this.getView().getModel("ud");
			var page = model.getProperty("/currentPage");
			if (page > 1) {
				model.setProperty("/currentPage", page - 1);
				this._updatePagedResults();
			}
		},

		onNextPage: function() {
			var model = this.getView().getModel("ud");
			var page = model.getProperty("/currentPage");
			var total = model.getProperty("/totalPages");
			if (page < total) {
				model.setProperty("/currentPage", page + 1);
				this._updatePagedResults();
			}
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantSelect").getSelectedKey();
			var sYear = this.byId("yearSelectUD").getSelectedKey();
			var sMonth = this.byId("monthSelectUD").getSelectedKey();

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

					if (sYear) {
						results = results.filter(function(item) {
							var rawDate = item.start_date;
							if (!rawDate) return true;

							var date = new Date(rawDate);
							if (isNaN(date.getTime())) return true;

							var yearMatch = date.getFullYear().toString() === sYear;
							var monthMatch = !sMonth || ("0" + (date.getMonth() + 1)).slice(-2) === sMonth;
							return yearMatch && monthMatch;
						});
					}

					that._updateDashboard(results);
				},
				error: function() {
					MessageToast.show("Error retrieving usage decision data.");
				}
			});
		},

		_updateDashboard: function(results) {
			var approved = 0,
				rejected = 0,
				i;

			for (i = 0; i < results.length; i++) {
				if (results[i].usage_decision_text === "Accepted") approved++;
				else if (results[i].usage_decision_text === "Rejected") rejected++;
			}

			var total = results.length;
			var pageSize = 10;
			var totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

			this.udModel.setData({
				results: results,
				currentPage: 1,
				pageSize: pageSize,
				totalPages: totalPages,
				pagedResults: results.slice(0, pageSize),
				total: total,
				approved: approved,
				rejected: rejected
			});

			this._buildChart(this.byId("udChart1"), results, "inspection_type", "Usage Decision by Inspection Type");
			this._buildChart(this.byId("udChart2"), results, "material", "Usage Decision by Material");
			this._buildChart(this.byId("udChart3"), results, "status", "Usage Decision by Status");
		},

		_updatePagedResults: function() {
			var model = this.getView().getModel("ud");
			var data = model.getProperty("/results");
			var page = model.getProperty("/currentPage");
			var size = model.getProperty("/pageSize");
			var start = (page - 1) * size;
			var end = start + size;
			model.setProperty("/pagedResults", data.slice(start, end));
		},

		_buildChart: function(oViz, data, groupField, title) {
			var map = {},
				i;

			for (i = 0; i < data.length; i++) {
				var item = data[i];
				var key = item[groupField] || "Unknown";

				if (!map[key]) {
					map[key] = {
						label: key,
						Accepted: 0,
						Rejected: 0
					};
				}
				if (item.usage_decision_text === "Accepted") {
					map[key].Accepted++;
				} else if (item.usage_decision_text === "Rejected") {
					map[key].Rejected++;
				}
			}

			var chartData = [],
				isPie = false;

			if (groupField === "status") {
				isPie = true;
				var pieMap = {
					"Accepted": 0,
					"Rejected": 0
				};
				for (var key in map) {
					pieMap["Accepted"] += map[key].Accepted;
					pieMap["Rejected"] += map[key].Rejected;
				}
				for (var label in pieMap) {
					chartData.push({
						label: label,
						value: pieMap[label]
					});
				}
			} else {
				for (var key2 in map) {
					chartData.push(map[key2]);
				}
			}

			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Category",
					value: "{label}"
				}],
				measures: isPie ? [{
					name: "Count",
					value: "{value}"
				}] : [{
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
			oViz.setVizType(isPie ? "pie" : "stacked_column");
			oViz.setVizProperties({
				title: {
					text: title,
					visible: true
				}
			});
			oViz.removeAllFeeds();

			if (isPie) {
				oViz.addFeed(new FeedItem({
					uid: "size",
					type: "Measure",
					values: ["Count"]
				}));
				oViz.addFeed(new FeedItem({
					uid: "color",
					type: "Dimension",
					values: ["Category"]
				}));
			} else {
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

			new VizTooltip().connect(oViz.getVizUid());
		}
	});
});