export type FilterType = 'all' | 'todo' | 'done'

export type TodoItem = {
	id: number
	text: string
	done: boolean
}
