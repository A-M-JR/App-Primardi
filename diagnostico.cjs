
const apiKey = "AIzaSyD_kCVvcfBvjN9P-_v5-godTnlrGBPXnJ8";
const fs = require('fs');
const https = require('https');

function getModels(version) {
    return new Promise((resolve, reject) => {
        https.get(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function run() {
    console.log("Iniciando listagem...");
    const v1 = await getModels('v1');
    const v1beta = await getModels('v1beta');

    const output = {
        v1: v1.models ? v1.models.map(m => m.name) : v1,
        v1beta: v1beta.models ? v1beta.models.map(m => m.name) : v1beta
    };

    fs.writeFileSync('gemini_diagnostico.json', JSON.stringify(output, null, 2));
    console.log("Concluído. Veja gemini_diagnostico.json");
}

run();
