const express = require("express");
const { google } = require("googleapis");

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.use(express.json());

function getCredentials() {

  if (process.env.NODE_ENV !== 'production' && !process.env.GOOGLE_TYPE) {
    return require('./credentials.json');
  }

  return {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    universe_domain: "googleapis.com"
  };
}

async function getSheetData(sheetName, range) {
  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1r4CeqEpV315mvCQMy7M77fppCwdX2mW4sC_5ZvUJQNo";

  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: `${sheetName}!${range}`,
  });

  return getRows.data;
}

async function appendSheetData(sheetName, range, values) {
  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1r4CeqEpV315mvCQMy7M77fppCwdX2mW4sC_5ZvUJQNo";

  const response = await googleSheets.spreadsheets.values.append({
    auth,
    spreadsheetId,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: values
    }
  });

  return response.data;
}

app.get("/", async (req, res) => {
  try {
    const data = await getSheetData("sellers", "B:B");
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/clients", async (req, res) => {
  try {
    const data = await getSheetData("clients", "B:D");
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/clients", async (req, res) => {
    try {

        const { dni, clientName, quantity, sellerName } = req.body;

        if (!dni || !clientName || quantity === null || quantity === undefined || !sellerName) {
            return res.status(400).json({ error: 'Se necesitan mas datos del cliente' });
        }

        const sheetName = 'clients';
        const range = 'A:D';

        const values = [[sellerName, dni, clientName, quantity]];

        const result = await appendSheetData(sheetName, range, values);

        console.log(`✅ Datos del cliente guardados exitosamente`);

        res.status(200).json({
            data: { sellerName, dni, clientName, quantity },
            updatedRows: result.updates.updatedRows
        });

    } catch (error) {
        console.error('Error al guardar datos del cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

app.post("/sells", async (req, res) => {
  try {
    const { sellerName, dni, clientName, quantity, price, paymentStatus, paymentMethod, timestamp, remarkText } = req.body;

    if (!sellerName) {
      return res.status(400).json({ error: 'El nombre del vendedor es requerido' });
    }

    if (!dni) {
      return res.status(400).json({ error: 'El DNI es requerido' });
    }

    if (!clientName) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }

    if (quantity === null || quantity === undefined || quantity === '') {
      return res.status(400).json({ error: 'La cantidad es requerida' });
    }

    if (price === null || price === undefined || price === '') {
      return res.status(400).json({ error: 'El precio es requerido' });
    }

    if (!paymentStatus) {
      return res.status(400).json({ error: 'El estado de pago es requerido' });
    }

    if (paymentStatus === 'Si Pago' && (!paymentMethod || paymentMethod.trim() === '')) {
      return res.status(400).json({ error: 'El método de pago es requerido' });
    }

    const finalPaymentMethod = paymentStatus === 'No Pago' ? 'null' : (paymentMethod || 'null');

    const finalTimestamp = timestamp || new Date().toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const finalRemarkText = remarkText || 'null';

    const values = [[sellerName, dni, clientName, quantity, price, paymentStatus, finalPaymentMethod, finalTimestamp, finalRemarkText]];
    const result = await appendSheetData("sells", "A:I", values);

    console.log(`✅ Todos los datos fueron guardados exitosamente`);

    res.status(200).json({ 
      sellerName: sellerName,
      dni: dni,
      clientName: clientName,
      quantity: quantity,
      price: price,
      paymentStatus: paymentStatus,
      paymentMethod: finalPaymentMethod,
      timestamp: finalTimestamp,
      remarkText: finalRemarkText,
      updatedRows: result.updates.updatedRows
    });

  } catch (error) {
    console.error('Error al guardar datos del vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(1337, () => console.log("Running on 1337"));