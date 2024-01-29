const fs = require('fs');

const HOSTAPD_FILE = '/mnt/mmcblk0p1/network/hostapd.conf';
//const HOSTAPD_FILE = './hostapd.conf';

const help = {
	ssid: {friendly: "SSID", help: [
		"SSID to be used in IEEE 802.11 management frames",
		"In other words, the Wi-Fi name"
	]},
	country_code: {friendly: "Country code", help: [
		"Country code (ISO/IEC 3166-1). Used to set regulatory domain.",
		"Set as needed to indicate country in which device is operating.",
		"This can limit available channels and transmit power."
	]},
	hw_mode: {friendly: "Operation mode", help: [
		"Operation mode (a = IEEE 802.11a, b = IEEE 802.11b, g = IEEE 802.11g,",
		"ad = IEEE 802.11ad (60 GHz); a/g options are used with IEEE 802.11n, too, to",
		"specify band)",
		"Default: IEEE 802.11b"
	]},
	channel: {friendly: "Channel number", help: [
		"Channel number (IEEE 802.11)",
		"(default: 0, i.e., not set)",
		"Please note that some drivers do not use this value from hostapd and the",
		"channel will need to be configured separately with iwconfig."
	]},
	macaddr_acl: {friendly: "MAC Address Filtering", help: [
		"Station MAC address -based authentication",
		"Please note that this kind of access control requires a driver that uses",
		"hostapd to take care of management frame processing and as such, this can be",
		"used with driver=hostap or driver=nl80211, but not with driver=madwifi.",
		"0 = accept unless in deny list",
		"1 = deny unless in accept list",
		"2 = use external RADIUS server (accept/deny lists are searched first)"
	]},
	auth_algs: {friendly: "Authentication algorithm", help: [
		"IEEE 802.11 specifies two authentication algorithms. hostapd can be",
		"configured to allow both of these or only one. Open system authentication",
		"should be used with IEEE 802.1X.",
		"Bit fields of allowed authentication algorithms:",
		"bit 0 = Open System Authentication",
		"bit 1 = Shared Key Authentication (requires WEP)"
	]},
	ignore_broadcast_ssid: {friendly: "Send empty SSID", help: [
		"Send empty SSID in beacons and ignore probe request frames that do not",
		"specify full SSID, i.e., require stations to know SSID.",
		"default: disabled (0)",
		"1 = send empty (length=0) SSID in beacon and ignore probe request for",
		"    broadcast SSID",
		"2 = clear SSID (ASCII 0), but keep the original length (this may be required",
		"    with some clients that do not support empty SSID) and ignore probe",
		"    requests for broadcast SSID"
	]},
	wpa: {friendly: "Enable WPA", help: [
		"Enable WPA. Setting this variable configures the AP to require WPA (either",
		"WPA-PSK or WPA-RADIUS/EAP based on other configuration). For WPA-PSK, either",
		"wpa_psk or wpa_passphrase must be set and wpa_key_mgmt must include WPA-PSK.",
		"Instead of wpa_psk / wpa_passphrase, wpa_psk_radius might suffice.",
		"For WPA-RADIUS/EAP, ieee8021x must be set (but without dynamic WEP keys),",
		"RADIUS authentication server must be configured, and WPA-EAP must be included",
		"in wpa_key_mgmt.",
		"This field is a bit field that can be used to enable WPA (IEEE 802.11i/D3.0)",
		"and/or WPA2 (full IEEE 802.11i/RSN):",
		"bit0 = WPA",
		"bit1 = IEEE 802.11i/RSN (WPA2)"
	]},
	wpa_passphrase: {friendly: "Passphrase", help: [
		"WPA pre-shared keys for WPA-PSK. This can be either entered as a 256-bit",
		"secret in hex format (64 hex digits), wpa_psk, or as an ASCII passphrase",
		"(8..63 characters) that will be converted to PSK. This conversion uses SSID",
		"so the PSK changes when ASCII passphrase is used and the SSID is changed."
	]},
	wpa_key_mgmt: {friendly: "WPA Key Management", help: [
		"Set of accepted key management algorithms (WPA-PSK, WPA-EAP, or both). The",
		"entries are separated with a space. WPA-PSK-SHA256 and WPA-EAP-SHA256 can be",
		"added to enable SHA256-based stronger algorithms."
	]},
	wpa_pairwise: {friendly: "Pairwise Key Management", help: [
		"Set of accepted cipher suites (encryption algorithms) for pairwise keys",
		"(unicast packets). This is a space separated list of algorithms:",
		"CCMP = AES in Counter mode with CBC-MAC [RFC 3610, IEEE 802.11i/D7.0]",
		"TKIP = Temporal Key Integrity Protocol [IEEE 802.11i/D7.0]",
		"Group cipher suite (encryption algorithm for broadcast and multicast frames)",
		"is automatically selected based on this configuration. If only CCMP is",
		"allowed as the pairwise cipher, group cipher will also be CCMP. Otherwise,",
		"TKIP will be used as the group cipher."
	]},
	wpa_group_rekey: {friendly: "Group Rekey Time", help: [
		"Time interval for rekeying GTK (broadcast/multicast encryption keys) in",
		"seconds."
	]},
	ieee80211n: {friendly: "IEEE 802.11n (HT)", help: [
		"Whether IEEE 802.11n (HT) is enabled",
		"0 = disabled (default)",
		"1 = enabled",
		"Note: You will also need to enable WMM for full HT functionality."
	]}
};

async function getWifi(request, response) {
	const r = fs.readFile(HOSTAPD_FILE, {encoding: 'utf-8'}, (err, data) => {
		var conf = {};
		data.split(/\r?\n/).forEach(line => {
			const pound = line.indexOf('#');
			const l = pound >= 0 ? line.slice(0, pound) : line;
			const equals = line.indexOf('=');
			if(equals >= 0) {
				const key = l.slice(0, equals);
				const value = l.slice(equals + 1);
				conf[key] = value;
			}
		});
		delete conf['']; // delete the empty lines
		response.render("wifi", {help, conf});
	});
}

const handleReboot = require('./admin.js').handleReboot;
async function postWifi(request, response) {
	const f = fs.createWriteStream(HOSTAPD_FILE);
	for(s in request.body) {
		if(help[s] !== undefined)
			for(const h of help[s].help)
				f.write("# " + h + "\n");
		f.write(s + "=" + request.body[s] + "\n");
		f.write("\n");
	}
	f.close(() => {
		handleReboot(request, response);
	})
}

async function handleWifi(request, response) {
	if(request.method === 'POST')
		postWifi(request, response);
	else
		getWifi(request, response);
}

module.exports = {
	handleWifi
}