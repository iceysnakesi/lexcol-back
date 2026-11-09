router.post('/webhook', async (req, res) => {
    const event = req.body;

    // Validar checksum (Wompi usa SHA-256)
    const isValid = validateWompiChecksum(event, process.env.WOMPI_EVENTS_SECRET);
    if (!isValid) return res.status(400).send('Invalid signature');

    if (event.event === 'transaction.updated') {
        const { status, payment_source_id } = event.data.transaction;

        if (status === 'APPROVED') {
            // Buscar usuario por payment_source_id y actualizar a Pro
            const user = await UserModel.findByPaymentSourceId(payment_source_id);
            if (user) {
                await UserModel.update(user.id, { membership_tier: 'pro' });
                console.log(`✅ User ${user.email} upgraded to Pro`);
            }
        } else if (status === 'DECLINED' || status === 'VOIDED') {
            // Manejar fallo (notificar al usuario, etc.)
        }
    }
    res.status(200).send('OK');
});