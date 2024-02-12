<?php
/*

MIT License

Copyright (c) 2024 Rodolfo González González

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Except as contained in this notice, the name of Rodolfo González González shall 
not be used in advertising or otherwise to promote the sale, use or other 
dealings in this Software without prior written authorization from 
Rodolfo González González.

-------------------------------------------------------------------------------

This is an example on how to use the component in a view.

*/
?>
<!-- some code here... -->

<div class="form">
    <div class="form-group">
        <?= Yii::t('App', 'Search for a country:') ?>        
        <?php 
        $continent = 'AMERICA';
        $url = Yii::app()->createUrl("path/to/search/endpoint");
        $script =<<<EOP
let selectedCountry = '';

// Here we do the search. Let's suppose that the endpoint returns something 
// like [{iso:'AR', country:'Argentina'}, ...]
async function searchCountry(keyword) {    
    const url = '{$url}/country/' + encodeURIComponent(keyword) + '/continent/{$continent}';

    const response = await fetch(url);
    return await response.json();
}

// Here we get the selected option. We can not bind the variable because 
// props don't accept semicolons. However, the SimpleAutocomplete component 
// provides an onChange event.
function handleSelect(event) {
    selectedCountry = event?.id ?? 0;
}
EOP;
        $Yii::app()->clientScript->registerScript('AutoComplete@head', $script, CClientScript::POS_HEAD);
        
        $this->widget('application.extensions.svelte-autocomplete.EAutoComplete', [
            // This is the HTML id of the element which will be created to 
            // inject the component, so it needs to be unique.
            'name' => 'search-country', 
            // Here you pass the props to the Svelte component.
            'props' => [
                'class' => 'form-control',
                'searchFunction' => "js:searchCountry",
                'delay' => "500",
                'valueFieldName' => "iso",
                'labelFieldName' => "country",
                'onChange' => "js:handleSelect"
            ]
        ]); 
        ?>
    </div>
</div>

<!-- some more code below... -->