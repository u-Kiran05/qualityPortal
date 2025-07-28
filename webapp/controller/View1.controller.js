sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageStrip"
], function(Controller, MessageToast, MessageStrip) {
	"use strict";

	return Controller.extend("QualityPortal.controller.View1", {
		onLoginPress: function() {
			var oView = this.getView();
			var sUser = oView.byId("username").getValue().trim();
			var sPass = oView.byId("password").getValue().trim();
			var oMsgStrip = oView.byId("msgStrip");

			// Reset previous messages
			oMsgStrip.setVisible(false);

			if (!sUser || !sPass) {
				oMsgStrip.setVisible(true);
				oMsgStrip.setText("Please enter both username and password.");
				oMsgStrip.setType("Warning");
				return;
			}

			var oModel = this.getOwnerComponent().getModel("ZPPModel");
			if (!oModel) {
				oMsgStrip.setVisible(true);
				oMsgStrip.setText("Login model not found.");
				oMsgStrip.setType("Error");
				return;
			}

			var sPath = "/ZPP_QLOGIN_V(p_bname='" + sUser + "',p_pass='" + encodeURIComponent(sPass) + "')/Set";
			var that = this;

			oModel.metadataLoaded().then(function () {
				oModel.read(sPath, {
					success: function(oData) {
						var result = oData.results && oData.results[0];
						if (result && result.login_status === "Y") {
							oMsgStrip.setVisible(true);
							oMsgStrip.setText("Login successful!");
							oMsgStrip.setType("Success");

							var oRouter = sap.ui.core.UIComponent.getRouterFor(that);
							oRouter.navTo("View2");
						} else {
							oMsgStrip.setVisible(true);
							oMsgStrip.setText("Invalid username or password.");
							oMsgStrip.setType("Error");
						}
					},
					error: function() {
						oMsgStrip.setVisible(true);
						oMsgStrip.setText("Server error during login. Please try again.");
						oMsgStrip.setType("Error");
					}
				});
			}).catch(function () {
				oMsgStrip.setVisible(true);
				oMsgStrip.setText("Metadata load failed.");
				oMsgStrip.setType("Error");
			});
		}
	});
});
