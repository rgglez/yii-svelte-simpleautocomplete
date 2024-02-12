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
*/

/**
 * This extension encapsulates the Svelte SimpleAutocomplete search component.
 */
class EAutoComplete extends CInputWidget
{
    public $props = [];

    //-------------------------------------------------------------------------

    protected $_baseUrl;

    //-------------------------------------------------------------------------

    /**
     * Publish the assets.
     */
    protected function publishAssets()
    {
        $this->_baseUrl = Yii::app()->assetManager->publish(dirname(__FILE__).DIRECTORY_SEPARATOR.'assets');
    }

    /**
     * Generate the HTML element where the Svelte component will be injected.
     * 
     * @param int $id the id of the element
     */
    protected function element($id)
    {
        $html  = CHtml::openTag('div', ['id'=>$id]);
        $html .= CHtml::closeTag('div');
        return $html;
    }

    /**
     * Create the instance of the Svelte component.
     * 
     * @param int $id the id of the element
     */
    protected function instance($id)
    {        
        $props = CJavaScript::encode($this->props);

        $script =<<<EOP
import { newSimpleAutocomplete as SimpleAutocomplete } from '{$this->_baseUrl}/main.js';

const target = document.querySelector('#{$id}');
const props = {$props}

SimpleAutocomplete(target, props);
EOP;

        return CHtml::script($script, ['type'=>'module']);
    }

    //-------------------------------------------------------------------------
    
    public function init()
    {
        $this->publishAssets();

        ob_start();        
    }

    public function run()
    {   
        $body = ob_get_contents();
        ob_end_clean();

        list($name, $id) = $this->resolveNameID();

        echo CHtml::scriptFile($this->_baseUrl.'/main.js', ['type'=>'module']);
        echo $this->element($id);
        echo $this->instance($id);
    }
}