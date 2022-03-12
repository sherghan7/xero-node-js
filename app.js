require('dotenv').config();
const express = require('express');
const app = express();
const ejs = require('ejs');
const jwtDecode = require('jwt-decode');
const {
    TokenSet
} = require('openid-client');
const {
    XeroAccessToken,
    XeroIdToken,
    XeroClient,
    Contact,
    LineItem,
    Invoice,
    Invoices,
    Phone,
    Contacts
} = require('xero-node');

const session = require('express-session');
const bodyParser = require('body-parser');


const port = process.env.PORT || 3000;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirectUrl = process.env.REDIRECT_URI;
const scopes = 'openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access';


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());


const xero = new XeroClient({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUris: [redirectUrl],
    openIdClient: TokenSet,
    scopes: scopes.split(" "),
});

if (!client_id || !client_secret || !redirectUrl) {
    throw Error('Environment Variables not all set - please check your .env file in the project root or create one!')
}



app.use(session({
    secret: 'something crazy',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false
    },
}));


const authenticationData = (req, res, next) => {
    return {
        decodedIdToken: req.session.decodedIdToken,
        decodedAccessToken: req.session.decodedAccessToken,
        tokenSet: req.session.tokenSet,
        allTenants: req.session.allTenants,
        activeTenant: req.session.activeTenant,

    }
}

app.get('/', (req, res) => {
	res.send(`<a href='/connect'>Connect to Xero</a>`);
});


app.get('/connect', async (req, res) => {
	try {
		const consentUrl= await xero.buildConsentUrl();
		res.redirect(consentUrl);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
})

app.get('/callback', async (req, res) => {
    try {
		const tokenSet = await xero.apiCallback(req.url);
		await xero.updateTenants();

		const decodedIdToken = jwtDecode(tokenSet.id_token);
		const decodedAccessToken = jwtDecode(tokenSet.access_token);

		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.tokenSet = tokenSet;
		req.session.allTenants = xero.tenants;
		req.session.activeTenant = xero.tenants[0];

		const authData = authenticationData(req, res);

		console.log(authData);

		res.redirect('/organisation');
	} catch (err) {
		res.send('Sorry, something went wrong');
	}

})

app.get('/organisation', async (req, res) => {
	try {
		const tokenSet = await xero.readTokenSet();
		console.log(tokenSet.expired() ? 'expired' : 'valid');
		const response = await xero.accountingApi.getOrganisations(req.session.activeTenant.tenantId);
		res.send(`Hello, ${response.body.organisations[0].name}`);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});


app.get('/invoice', async (req, res) => {
    try {
        const tokenSet = await xero.readTokenSet();
        console.log(tokenSet.expired() ? 'expired' : 'valid');
        const response = await xero.accountingApi.getInvoices(req.session.activeTenant.tenantId);
        const invoices = response.body.invoices;
        const total = invoices.reduce((acc, invoice) => {
            return acc + invoice.total;
        }, 0);
        res.send(`Total Invoice amount is ${total}`);
    } catch (err) {
        res.send('Sorry, something went wrong');
    }

});

app.get('/profit-loss', async (req, res) => {
    const plFromDate = "2019-01-01";
    const plToDate = "2019-12-31";
    const plPeriods = 6;
    const plTimeframe = "QUARTER";
    const plTrackingCategoryID = undefined;
    const plTrackingOptionID = undefined;
    const plTrackingCategoryID2 = undefined;
    const plTrackingOptionID2 = undefined;
    const plStandardLayout = true;
    const plPaymentsOnly = false;
    const getProfitAndLossResponse = await xero.accountingApi.getReportProfitAndLoss(req.session.activeTenant.tenantId, plFromDate, plToDate, plPeriods, plTimeframe, plTrackingCategoryID, plTrackingOptionID, plTrackingCategoryID2, plTrackingOptionID2, plStandardLayout, plPaymentsOnly);
    res.send(getProfitAndLossResponse.body);


});




app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})