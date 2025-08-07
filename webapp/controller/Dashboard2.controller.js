sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/viz/ui5/controls/VizTooltip",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function(Controller, JSONModel, FlattenedDataset, FeedItem, VizTooltip, MessageToast, MessageBox) {
	"use strict";

	return Controller.extend("QualityPortal.controller.Dashboard2", {

		onInit: function() {
			this.lotModel = new JSONModel({
				results: [],
				pagedResults: [],
				currentPage: 1,
				pageSize: 10,
				totalPages: 0,
				total: 0,
				types: 0,
				materials: 0,
				units: 0
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

		onPrevPage: function() {
			var model = this.getView().getModel("lot");
			var page = model.getProperty("/currentPage");
			if (page > 1) {
				model.setProperty("/currentPage", page - 1);
				this._updatePagedResults();
			}
		},

		onNextPage: function() {
			var model = this.getView().getModel("lot");
			var page = model.getProperty("/currentPage");
			var total = model.getProperty("/totalPages");
			if (page < total) {
				model.setProperty("/currentPage", page + 1);
				this._updatePagedResults();
			}
		},

		onApplyFilter: function() {
			var sPlant = this.byId("plantSelect").getSelectedKey();
			var sYear = this.byId("yearSelect").getSelectedKey();
			var sMonth = this.byId("monthSelect").getSelectedKey();

			if (!sPlant) {
				MessageToast.show("Please select a Plant");
				return;
			}

			var that = this;
			var oModel = this.getOwnerComponent().getModel("ZINSModel");
			var sPath = "/ZQM_INSPECTIONLOT_CDS(p_plant='" + sPlant + "')/Set";

			oModel.metadataLoaded().then(function () {
				oModel.read(sPath, {
					success: function(oData) {
						var results = oData.results || [];

						if (sYear) {
							results = results.filter(function(item) {
								var d = new Date(item.start_date);
								if (isNaN(d.getTime())) return false;
								var yearMatch = d.getFullYear().toString() === sYear;
								var monthMatch = !sMonth || ("0" + (d.getMonth() + 1)).slice(-2) === sMonth;
								return yearMatch && monthMatch;
							});
						}

						that._processData(results);
					},
					error: function() {
						MessageToast.show("Failed to load inspection data");
					}
				});
			});
		},


		_processData: function(results) {
			var typeMap = {},
				materialMap = {},
				unitMap = {};

			for (var i = 0; i < results.length; i++) {
				var r = results[i];
				r.inspection_type_text = this._mapType(r.inspection_type);
				r.unit_text = this._mapUnit(r.unit);
				r.material_text = this._mapMaterial(r.material_text);

				typeMap[r.inspection_type_text] = true;
				materialMap[r.material_text] = true;
				unitMap[r.unit_text] = true;
			}

			var total = results.length;
			var pageSize = 10;
			var totalPages = Math.ceil(total / pageSize);

			this.lotModel.setData({
				results: results,
				currentPage: 1,
				pageSize: pageSize,
				totalPages: totalPages,
				pagedResults: results.slice(0, pageSize),
				total: total,
				types: Object.keys(typeMap).length,
				materials: Object.keys(materialMap).length,
				units: Object.keys(unitMap).length
			});

			this._buildBar(this.byId("chart1"), results, "inspection_type_text", "Lots by Inspection Type");
			this._buildDonut(this.byId("chart2"), results, "material_text", "Lots by Material");
			this._buildLine(this.byId("chart3"), results, "start_date", "Monthly Trend");
		},

		_updatePagedResults: function() {
			var model = this.getView().getModel("lot");
			var results = model.getProperty("/results");
			var page = model.getProperty("/currentPage");
			var size = model.getProperty("/pageSize");
			var start = (page - 1) * size;
			var end = start + size;
			model.setProperty("/pagedResults", results.slice(start, end));
		},

		_mapType: function(code) {
			var map = {
				"01": "Incoming",
				"02": "In-Process",
				"03": "Final",
				"04": "Audit",
				"05": "Sample"
			};
			return map[code] || code || "Unknown";
		},

		_mapUnit: function(code) {
			var map = {
				"EA": "Each",
				"KG": "Kilogram",
				"PC": "Piece",
				"L": "Litre"
			};
			return map[code] || code || "Unknown";
		},

		_mapMaterial: function(code) {
			var map = {
				"FM": "Frame",
				"RG": "Ring",
				"WD": "Washer Disk",
				"BL": "Bolt",
				"RM": "Raw Material",
				"FG": "Finished Good"
			};
			return map[code] || code || ("Material " + code);
		},

		_buildBar: function(oViz, data, field, title) {
			var map = {},
				i;
			for (i = 0; i < data.length; i++) {
				var key = data[i][field] || "Unknown";
				if (!map[key]) {
					map[key] = {
						Category: key,
						Count: 0
					};
				}
				map[key].Count++;
			}
			var chartData = [];
			for (var key in map) {
				chartData.push(map[key]);
			}
			oViz.setVizType("column");
			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Category",
					value: "{Category}"
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
					text: title,
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
				values: ["Category"]
			}));
			new VizTooltip().connect(oViz.getVizUid());
		},

		_buildDonut: function(oViz, data, field, title) {
			var map = {},
				i;
			for (i = 0; i < data.length; i++) {
				var key = data[i][field] || "Unknown";
				map[key] = (map[key] || 0) + 1;
			}
			var chartData = [];
			for (var key in map) {
				chartData.push({
					label: key,
					value: map[key]
				});
			}
			oViz.setVizType("donut");
			oViz.setDataset(new FlattenedDataset({
				dimensions: [{
					name: "Label",
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
					text: title,
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
				values: ["Label"]
			}));
			new VizTooltip().connect(oViz.getVizUid());
		},

		_buildLine: function(oViz, data, field, title) {
			var map = {},
				i;
			for (i = 0; i < data.length; i++) {
				var d = new Date(data[i][field]);
				if (!isNaN(d.getTime())) {
					var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
					map[key] = (map[key] || 0) + 1;
				}
			}
			var chartData = [];
			for (var key in map) {
				chartData.push({
					Period: key,
					Count: map[key]
				});
			}
			chartData.sort(function(a, b) {
				return a.Period > b.Period ? 1 : -1;
			});
			oViz.setVizType("line");
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
					text: title,
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
			new VizTooltip().connect(oViz.getVizUid());
		}
	});
});