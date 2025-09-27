# Svelte 5

In svelte projects, use svelte 5 standard syntax.

## Svelte structure

Keep logic at the top and html structure at the bottom.

## $state

```
<script lang="ts">
	let count = $state(0)
</script>
```

## $derived

```
<script lang="ts">
	let count = $state(0);
	let doubled = $derived(count * 2)
</script>
```

## $props

```
<script lang="ts">
    type Props = {
        adjective:  'happy' | 'sad'
    }
    let { adjective = 'happy' }: Props = $props()
</script>
```

## $bindable

```
<script lang="ts">
	let { value = $bindable(), ...props } = $props()
</script>
```

## $effect

```
<script lang="ts">
    // Instead of onMount and onDestroy, use $effect or $effect.pre to run before render
    // Globally accessible, no need to import
    $effect(() => {
        my_setup()
        // Don't turn directly turn the callback of $effect() into async
        my_async_function()
        return my_teardown_function
    })
</script>
```

## Onclick

The `on:click` is now `onclick` and the `preventDefault` should be called inside the handler function. Other events are similar.
```
<button onclick={(e) => {my_handler(e)}}>
```

