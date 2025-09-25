<script lang="ts">
	import TodoList from '../components/TodoList.svelte'
	import type { FilterType, TodoItem } from '../components/types'

	let new_todo = $state<TodoItem>({
		id: 1,
		text: '',
		done: false
	})

	let todos = $state<TodoItem[]>([])

	let active_filter = $state<FilterType>('all')
	let filtered_todos = $derived.by(() => {
		if (active_filter === 'todo') {
			return todos.filter((item) => !item.done)
		}
		if (active_filter === 'done') {
			return todos.filter((item) => item.done)
		}
		return todos
	})

	// $inspect(new_todo.text)
	let add_todo = () => {
		// TODO text needs to not be empty
		todos.push({ ...new_todo })
		new_todo.id += 1
		new_todo.text = ''
	}

	let remove_todo = (id: number) => {
		let index = todos.findIndex((item) => item.id === id)
		todos.splice(index, 1)
	}

	let toggle_todo = (id: number) => {
		let index = todos.findIndex((item) => item.id === id)
		todos[index].done = !todos[index].done
	}
</script>

{#snippet choose_filter(filter_name: FilterType)}
	<button
		class={[
			'transition-color rounded-lg border border-gray-200 px-4 py-2',
			{ 'border-blue-600 bg-blue-600 text-white': filter_name === active_filter }
		]}
		onclick={() => {
			active_filter = filter_name
		}}>{filter_name}</button
	>
{/snippet}

<main class="mx-auto flex max-w-2xl flex-col items-center gap-6 p-6">
	<h1 class="text-3xl font-bold text-gray-800">My ToDo App</h1>
	<div class="flex w-full gap-2">
		<input
			type="text"
			class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			bind:value={new_todo.text}
			placeholder="Add a new task..."
		/>
		<button onclick={add_todo} class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
			Add
		</button>
	</div>
	{#if todos.length}
		<div class="text-gray-500">
			{todos.filter((t) => t.done).length}/{todos.length} completed
		</div>
	{:else}
		<div class="text-gray-500">Add a todo to get started</div>
	{/if}
	<div class="w-full">
		<div class="flex justify-center gap-2">
			{@render choose_filter('all')}
			{@render choose_filter('todo')}
			{@render choose_filter('done')}
		</div>
	</div>
	<div class="w-full">
		<TodoList todos={filtered_todos} {remove_todo} {toggle_todo} />
	</div>
</main>
