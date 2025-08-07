sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function(Controller, JSONModel, FlattenedDataset, FeedItem, MessageToast, MessageBox) {
	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard1", {

		onInit: function() {
			this.lotModel = new JSONModel({
				totalLots: 0,
				approved: 0,
				rejected: 0,
				results: [],
				currentPage: 1,
				pageSize: 10,
				totalPages: 0,
				pagedResults: []
			});
			this.getView().setModel(this.lotModel, "lot");
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
		onBack: function() {
			sap.ui.core.UIComponent.getRouterFor(this).navTo("View2");
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantSelect").getSelectedKey();
			var sYear = this.byId("yearSelect").getSelectedKey();
			var sMonth = this.byId("monthSelect").getSelectedKey();

			if (!sPlant) {
				MessageToast.show("Please select a plant.");
				return;
			}

			var oModel = this.getOwnerComponent().getModel("ZRESModel");
			var sPath = "/ZQM_RESRECORDS(p_plant='" + sPlant + "')/Set";
			var that = this;
			
			oModel.metadataLoaded().then(function () {
				oModel.read(sPath, {
					success: function (oData) {
						var results = oData.results || [];
			
						// Filter by year/month
						if (sYear) {
							results = results.filter(function (item) {
								var rawDate = item.start_date;
								var date = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
								if (isNaN(date.getTime())) return false;
								var matchYear = date.getFullYear().toString() === sYear;
								var matchMonth = !sMonth || (("0" + (date.getMonth() + 1)).slice(-2) === sMonth);
								return matchYear && matchMonth;
							});
						}
			
						// KPI counts
						var approved = 0, rejected = 0;
						for (var i = 0; i < results.length; i++) {
							if (results[i].usage_decision === "A") approved++;
							else if (results[i].usage_decision === "R") rejected++;
						}
			
						var totalLots = results.length;
						var pageSize = 10;
						var totalPages = Math.ceil(totalLots / pageSize);
			
						that.lotModel.setData({
							totalLots: totalLots,
							approved: approved,
							rejected: rejected,
							results: results,
							currentPage: 1,
							pageSize: pageSize,
							totalPages: totalPages,
							pagedResults: results.slice(0, pageSize)
						});
			
						that._updateBarChart(results);
						that._updateDonutChart(results);
						that._updateLineChart(results);
					},
					error: function () {
						MessageToast.show("Failed to fetch inspection records.");
					}
				});
			});
		},

		onNextPage: function() {
			var model = this.getView().getModel("lot");
			var currentPage = model.getProperty("/currentPage");
			var totalPages = model.getProperty("/totalPages");

			if (currentPage < totalPages) {
				model.setProperty("/currentPage", currentPage + 1);
				this._updatePagedResults();
			}
		},

		onPrevPage: function() {
			var model = this.getView().getModel("lot");
			var currentPage = model.getProperty("/currentPage");

			if (currentPage > 1) {
				model.setProperty("/currentPage", currentPage - 1);
				this._updatePagedResults();
			}
		},

		_updatePagedResults: function() {
			var model = this.getView().getModel("lot");
			var allResults = model.getProperty("/results");
			var page = model.getProperty("/currentPage");
			var size = model.getProperty("/pageSize");

			var start = (page - 1) * size;
			var end = start + size;
			model.setProperty("/pagedResults", allResults.slice(start, end));
		},

		_updateBarChart: function(data) {
			var typeLabels = {
				"01": "Goods Receipt",
				"02": "In-Process",
				"03": "Final",
				"04": "Production",
				"05": "Audit",
				"": "Unknown"
			};

			var typeMap = {};
			for (var i = 0; i < data.length; i++) {
				var code = data[i].inspection_type || "";
				var label = typeLabels[code] || code;
				if (!typeMap[label]) {
					typeMap[label] = {
						inspection_type: label,
						Approved: 0,
						Rejected: 0
					};
				}
				if (data[i].usage_decision === "A") {
					typeMap[label].Approved++;
				} else if (data[i].usage_decision === "R") {
					typeMap[label].Rejected++;
				}
			}

			var chartData = [];
			for (var key in typeMap) {
				chartData.push(typeMap[key]);
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

			new sap.viz.ui5.controls.VizTooltip().connect(oViz.getVizUid());
		},

		_updateDonutChart: function(data) {
			var materialLabels = {
				"FG": "Finished Goods",
				"RM": "Raw Material",
				"SFG": "Semi-Finished Goods",
				"PKG": "Packaging Material",
				"SP": "Spare Parts",
				"LAB": "Lab Material",
				"": "Unknown"
			};

			var materialMap = {};
			for (var i = 0; i < data.length; i++) {
				var code = data[i].material_text || "";
				var label = materialLabels[code] || code;
				if (!materialMap[label]) {
					materialMap[label] = 0;
				}
				materialMap[label]++;
			}

			var chartData = [];
			for (var key in materialMap) {
				chartData.push({
					label: key,
					value: materialMap[key]
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
			oViz.setModel(new JSONModel(chartData));
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

			new sap.viz.ui5.controls.VizTooltip().connect(oViz.getVizUid());
		},

		_updateLineChart: function(data) {
			var trendMap = {},
				i;
			for (i = 0; i < data.length; i++) {
				var d = new Date(data[i].start_date);
				if (isNaN(d.getTime())) continue;
				var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
				trendMap[key] = (trendMap[key] || 0) + 1;
			}

			var chartData = [];
			var keys = Object.keys(trendMap).sort();
			for (i = 0; i < keys.length; i++) {
				chartData.push({
					Period: keys[i],
					Count: trendMap[keys[i]]
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
			oViz.setModel(new JSONModel(chartData));
			oViz.setVizProperties({
				title: {
					text: "Monthly Result Entry Trend",
					visible: true
				}
			});
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