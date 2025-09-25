<script lang="ts">
	import type { TodoItem } from './types'
	import { fly } from 'svelte/transition'
	import { flip } from 'svelte/animate'

	let {
		todos,
		remove_todo,
		toggle_todo
	}: { todos: TodoItem[]; remove_todo: (id: number) => void; toggle_todo: (id: number) => void } = $props()
</script>

{#snippet todo_item(id: number, text: string, done: boolean)}
	<div
		class="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-gray-50"
		transition:fly={{ y: -20, duration: 300 }}
	>
		<input
			type="checkbox"
			class="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
			onclick={() => {
				toggle_todo(id)
			}}
			checked={done}
		/>
		<div class={['flex-1 transition-all duration-500', { 'text-gray-400': done }]}>
			{text}
		</div>
		<button class="text-red-500 transition-colors hover:text-red-700" onclick={() => remove_todo(id)}>Remove</button>
	</div>
{/snippet}

{#each todos as { id, text, done } (id)}
	<div animate:flip={{ duration: 500 }}>
		{@render todo_item(id, text, done)}
	</div>
{/each}
