# yii-svelte-simpleautocomplete

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) 
![GitHub issues](https://img.shields.io/github/issues/rgglez/yii-svelte-simpleautocomplete) 
![GitHub commit activity](https://img.shields.io/github/commit-activity/y/rgglez/yii-svelte-simpleautocomplete)

Extension for integrating the [SimpleAutocomplete](https://github.com/pstanoev/simple-svelte-autocomplete) Svelte component into a [Yii 1.1](https://www.yiiframework.com/) view.

## Installation

Just place the code in a subdirectory of your extensions directory. A pre-compiled *[main.js](assets/main.js)* file is already in the assets directory, and this will be copied to Yii's assets file.

## Compilation

In case that you need to recompile the Svelte code, you can find it in the *src* directory. The included *[package.json](src/package.json)* provides commands for **[pnpm](https://pnpm.io)**: 

1. Install the dependencies:
```
pnpm install
```
2. Compile the Svelte code:
```
pnpm run build:rollup
```

This will generate a new *main.js* file in the assets directory. Remember to delete the *main.js* file from your Yii assets directory, in case that your assets manager does not replaces it automatically.

## Usage

* To learn how to use the extension, see the [sample view](examples/index.php) in the examples directory.
* To learn which options can be passed to the Svelte component,
see [this](https://github.com/pstanoev/simple-svelte-autocomplete) and [this](http://simple-svelte-autocomplete.surge.sh/) pages.

## Notes

Notice that the SimpleAutocomplete component documentation says that you can use the bind sintax as in *bind:selectedItem*.  However, it seems that there is no way to do it from the Yii view. See the example view for details.

## License

MIT License. Please read the [LICENSE](LICENSE) file.

Copyright (c) 2024 Rodolfo González González.