const express = require('express');
const app = express();

// Use Express' built-in JSON parser
app.use(express.json());


// API routes will go here...


// Serve static files from the public directory
app.use(express.static('public'));

// Catch-all route to serve the index.html file for any unmatched routes
app.use((req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});