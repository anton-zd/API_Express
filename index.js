const express = require("express");
const { google } = require("googleapis");

const app = express();

// Enable CORS manually (replace the cors() line)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Add middleware to parse JSON bodies
app.use(express.json());

// Function to get credentials (local vs production)
function getCredentials() {
  // If running locally (has credentials.json file)
  if (process.env.NODE_ENV !== 'production' && !process.env.GOOGLE_TYPE) {
    return require('./credentials.json');
  }
  
  // If running in production (Railway with environment variables)
  return {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
  };
}

// Helper function to avoid code repetition
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

// Helper function to append data to sheet
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

// ...existing code... (all your routes remain the same)

// Original route for sellers data (column B)
app.get("/", async (req, res) => {
  try {
    const data = await getSheetData("sellers", "B:B");
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New route for clients data (column C)
app.get("/clients", async (req, res) => {
  try {
    const data = await getSheetData("clients", "B:D");
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: POST endpoint to save seller data to sells sheet
// POST endpoint to save seller data to sells sheet
app.post("/sells", async (req, res) => {
  try {
    const { sellerName, dni, clientName, quantity, price, paymentStatus, paymentMethod, timestamp, remarkText } = req.body;
    
    // Validate that sellerName is provided (should be "Fallback Seller")
    if (!sellerName) {
      return res.status(400).json({ error: 'Seller name is required' });
    }
    
    // Validate that DNI is provided
    if (!dni) {
      return res.status(400).json({ error: 'DNI is required' });
    }
    
    // Validate that clientName is provided
    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    
    // Validate that quantity is provided (allow 0)
    if (quantity === null || quantity === undefined || quantity === '') {
      return res.status(400).json({ error: 'Quantity is required' });
    }
    
    // Validate that price is provided (allow 0)
    if (price === null || price === undefined || price === '') {
      return res.status(400).json({ error: 'Price is required' });
    }
    
    // Validate that paymentStatus is provided
    if (!paymentStatus) {
      return res.status(400).json({ error: 'Payment status is required' });
    }
    
    // Validate payment method only if payment status is "Si Pago"
    if (paymentStatus === 'Si Pago' && (!paymentMethod || paymentMethod.trim() === '')) {
      return res.status(400).json({ error: 'Payment method is required when payment status is "Si Pago"' });
    }
    
    // Ensure paymentMethod is empty string for "No Pago" status
    const finalPaymentMethod = paymentStatus === 'No Pago' ? 'none' : (paymentMethod || 'none');
    
    // Use provided timestamp or create server timestamp as fallback
    const finalTimestamp = timestamp || new Date().toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Handle remark text - use provided text or empty string
    const finalRemarkText = remarkText || 'none';
    
    // Append data to columns A through I in sells sheet
    const values = [[sellerName, dni, clientName, quantity, price, paymentStatus, finalPaymentMethod, finalTimestamp, finalRemarkText]];
    const result = await appendSheetData("sells", "A:I", values);
    
    console.log(`✅ All data was successfully saved`);
    
    res.status(200).json({ 
      message: 'Seller data saved successfully',
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
    console.error('Error saving seller data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(1337, () => console.log("running on 1337"));