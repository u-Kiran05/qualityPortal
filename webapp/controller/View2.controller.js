sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox"
], function(Controller, MessageBox) {
	"use strict";

	return Controller.extend("QualityPortal.controller.View2", {
		onInit: function() {},

		onInspectionPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard2");
		},

		onUsageDecisionPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard3");
		},

		onResultRecordingPress: function() {
			this.getOwnerComponent().getRouter().navTo("Dashboard1");
		},

		onLogout: function() {
			MessageBox.confirm("Are you sure you want to logout?", {
				title: "Confirm Logout",
				icon: MessageBox.Icon.QUESTION,
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				emphasizedAction: MessageBox.Action.YES,
				onClose: function(oAction) {
					if (oAction === MessageBox.Action.YES) {
						sap.ui.core.UIComponent.getRouterFor(this).navTo("View1");
					}
				}.bind(this)
			});
		}
	});
});
