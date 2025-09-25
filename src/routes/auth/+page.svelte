<script lang="ts">
	import { onMount } from 'svelte'
	let auth_status: { authenticated: boolean; user: string | null } = $state({ authenticated: false, user: null })

	onMount(async () => {
		const response = await fetch('https://burnysc2.xyz/login/api_status', {
			// Ensures cookies are sent with the request
			credentials: 'include'
		})
		auth_status = await response.json()
	})
</script>

{#if auth_status.authenticated}
	<p>Welcome, {auth_status.user}!</p>
{:else}
	<a href="https://burnysc2.xyz/login">Log in</a>
{/if}
