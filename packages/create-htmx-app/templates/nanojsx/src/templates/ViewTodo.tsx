import { h } from "nano-jsx";
import type { Filter, Todo } from "../types";

export const ViewTodo = ({ todo, filter }: { todo: Todo; filter: Filter }) => {
	const isChecked = todo.status === "checked";

	return (
		<div
			class="flex items-start border-b-2 border-gray-100 px-4 py-4 fill-current"
			id={`todo-${todo.id}`}
		>
			<div
				class="text-gray-500 stroke-current cursor-pointer"
				hx-put={`/api/todos/${todo.id}/toggle-status?filter=${filter}`}
				hx-target={`#todo-${todo.id}`}
				hx-swap="outerHTML"
			>
				{isChecked ? (
					<svg viewBox="0 0 512 512" width="24" height="24">
						<path
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="32"
							d="M352 176L217.6 336 160 272"
						/>
						<rect
							fill="none"
							x="64"
							y="64"
							width="384"
							height="384"
							rx="48"
							ry="48"
							stroke-linejoin="round"
							stroke-width="32"
						/>
					</svg>
				) : (
					<svg viewBox="0 0 512 512" width="24" height="24">
						<path
							d="M416 448H96a32.09 32.09 0 01-32-32V96a32.09 32.09 0 0132-32h320a32.09 32.09 0 0132 32v320a32.09 32.09 0 01-32 32z"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="32"
						/>
					</svg>
				)}
			</div>
			<div class={`ml-4 ${isChecked ? "line-through text-gray-400" : ""}`}>
				{todo.value}
			</div>
		</div>
	);
};
