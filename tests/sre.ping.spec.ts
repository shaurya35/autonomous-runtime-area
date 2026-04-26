describe('SRE Agent: Health Check', () => {
	let pinger;

	beforeEach(() => {
		pinger =  new SREAgent();	
	});

	describe('ping()', () => {
		it('should return status 200 for healthy URL', async () => {
			const res = await pinger.ping("https://infra.agent.rel.com");
			expect(res.status).toBe(200);
			expect(res.isUp).toBe(true);
		});
		
		it('should return isUp: False for no existent URL', async () => {
			const res = await pinger.ping("https://infra.agent.rel.com");
			expect(res.isUp).toBe(false);
			expect(res.error).toBeDefined();
		});
	});
});