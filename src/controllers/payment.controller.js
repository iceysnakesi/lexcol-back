const axios = require('axios'); // npm install axios

const PaymentController = {
    // 1. Crear la fuente de pago (Payment Source)
    async createPaymentSource(req, res) {
        try {
            const { token, type } = req.body; // 'CARD' o 'NEQUI'
            const userId = req.user.id;

            // Wompi requiere el token de aceptación para crear fuentes de pago
            const acceptanceToken = await getAcceptanceToken();

            const response = await axios.post('https://sandbox.wompi.co/v1/payment_sources', {
                type: type, // 'CARD' o 'NEQUI'
                token: token,
                customer_email: req.user.email,
                acceptance_token: acceptanceToken,
            }, {
                headers: {
                    Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
                },
            });

            const paymentSourceId = response.data.data.id;

            // Guardar el ID en la base de datos del usuario
            await UserModel.updatePaymentSource(userId, paymentSourceId);

            res.json({ success: true, payment_source_id: paymentSourceId });
        } catch (err) {
            console.error('Wompi Source Error:', err.response?.data || err.message);
            res.status(500).json({ error: 'Failed to create payment source' });
        }
    },

    // 2. Cobro inicial o recurrente usando la fuente de pago
    async chargeSubscription(req, res) {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user.wompi_payment_source_id) {
                return res.status(400).json({ error: 'No payment source found' });
            }

            const reference = `LEXCOL-PRO-${userId}-${Date.now()}`;

            const response = await axios.post('https://sandbox.wompi.co/v1/transactions', {
                amount_in_cents: 5000000, // $50,000 COP (ejemplo)
                currency: 'COP',
                customer_email: user.email,
                reference: reference,
                payment_source_id: user.wompi_payment_source_id,
                // Si es la primera vez, requiere aceptación
                acceptance_token: await getAcceptanceToken(),
            }, {
                headers: {
                    Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
                },
            });

            // La transacción queda PENDING. El webhook confirmará el APPROVED.
            res.json({ success: true, transaction_id: response.data.data.id });
        } catch (err) {
            console.error('Wompi Charge Error:', err.response?.data || err.message);
            res.status(500).json({ error: 'Failed to charge' });
        }
    }
};

// Helper para obtener el token de aceptación obligatorio
async function getAcceptanceToken() {
    const res = await axios.get('https://sandbox.wompi.co/v1/merchants/' + process.env.WOMPI_PUBLIC_KEY);
    return res.data.data.presigned_acceptance.acceptance_token;
}