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
			var oStatusText = oView.byId("statusText");

			// Reset previous messages
			oMsgStrip.setVisible(false);
			oStatusText.setText("");

			// Validate inputs
			if (!sUser || !sPass) {
				oMsgStrip.setVisible(true);
				oMsgStrip.setText("Please enter both username and password.");
				oMsgStrip.setType("Warning");
				return;
			}

			// Call OData service
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZPP_QLOGIN_V_CDS/");
			var sPath = "/ZPP_QLOGIN_V(p_bname='" + sUser + "',p_pass='" + encodeURIComponent(sPass) + "')/Set";

			var that = this;

			oModel.read(sPath, {
				success: function(oData) {
					var result = oData.results && oData.results[0];
					if (result && result.login_status === "Y") {
						oMsgStrip.setVisible(true);
						oMsgStrip.setText("Login successful!");
						oMsgStrip.setType("Success");

						var oRouter = sap.ui.core.UIComponent.getRouterFor(that);
						oRouter.navTo("Dashboard1");
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
					oStatusText.setText("Login failed.");
				}
			});

		}
	});
});