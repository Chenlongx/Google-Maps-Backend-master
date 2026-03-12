(function () {
  function getTemplate() {
    return `
    <section class="ws-config-card ws-config-launcher ws-config-launcher-ai" id="wsAiRoutingCard">
        <div class="ws-config-head">
            <div class="ws-config-copy">
                <span class="ws-config-kicker">&#65;&#73; &#82;&#111;&#117;&#116;&#105;&#110;&#103; &#87;&#111;&#114;&#107;&#115;&#112;&#97;&#99;&#101;</span>
                <h2>&#65;&#73; &#27169;&#22411;&#36335;&#30001;&#24037;&#20316;&#21488;</h2>
                <p>&#23558; provider&#12289;model route &#19982; secret &#25277;&#31163;&#20026;&#29420;&#31435;&#31574;&#30053;&#24037;&#20316;&#21488;&#65292;&#29992;&#20110;&#24555;&#36895;&#20999;&#25442;&#23448;&#26041;&#25509;&#21475;&#12289;&#20013;&#36716;&#32593;&#20851;&#19982;&#20351;&#29992;&#27169;&#22411;&#12290;</p>
            </div>
            <div class="ws-config-badges">
                <div class="ws-config-badge">
                    <span>&#25509;&#20837; Provider</span>
                    <strong id="wsAiProviderCount">--</strong>
                </div>
                <div class="ws-config-badge">
                    <span>&#27169;&#22411;&#36335;&#30001;</span>
                    <strong id="wsAiRouteCount">--</strong>
                </div>
                <div class="ws-config-badge">
                    <span>Secret &#24341;&#29992;</span>
                    <strong id="wsAiSecretCount">--</strong>
                </div>
            </div>
        </div>
        <div class="ws-config-launcher-footer">
            <div class="ws-config-preview ws-config-preview-inline">
                <span class="ws-config-preview-label">&#24555;&#36895;&#39044;&#35272;</span>
                <strong id="wsAiRoutingPreview">--</strong>
                <small id="wsAiRoutingPreviewHint">--</small>
            </div>
            <div class="ws-config-launcher-actions">
                <button class="ws-page-btn" id="wsAiRoutingRefreshBtn" type="button">&#37325;&#26032;&#35835;&#21462;</button>
                <button class="ws-refresh-btn" id="wsAiRoutingOpenBtn" type="button">&#25171;&#24320;&#24037;&#20316;&#21488;</button>
            </div>
        </div>
    </section>
    <div class="ws-modal-backdrop" id="wsAiRoutingModal" hidden>
        <div class="ws-modal-card ws-ai-routing-modal">
            <div class="ws-modal-header">
                <div>
                    <h3>&#65;&#73; &#27169;&#22411;&#36335;&#30001;&#24037;&#20316;&#21488;</h3>
                    <p>&#22312;&#19968;&#20010;&#29420;&#31435;&#38754;&#26495;&#20013;&#32534;&#36753; provider&#12289;model route &#19982; <span class="ws-config-mono">whatsapp.secrets</span> &#24341;&#29992;&#65292;&#20445;&#25345; Worker &#35843;&#29992;&#38142;&#36335;&#21487;&#35270;&#12289;&#21487;&#20462;&#25913;&#12290;</p>
                </div>
                <button class="ws-modal-close" id="wsCloseAiRoutingModal" type="button">&times;</button>
            </div>
            <div class="ws-modal-body">
                <div class="ws-ai-shell">
                    <div class="ws-ai-summary-bar">
                        <div class="ws-ai-summary-copy">
                            <span class="ws-ai-summary-kicker">&#80;&#114;&#111;&#118;&#105;&#100;&#101;&#114; &#38; &#82;&#111;&#117;&#116;&#101; &#68;&#101;&#115;&#107;</span>
                            <strong>&#29992;&#19968;&#20010;&#24037;&#20316;&#21488;&#31649;&#29702;&#19978;&#28216;&#25509;&#20837;&#12289;&#36335;&#30001;&#25351;&#21521;&#21644;&#23494;&#38053;&#24341;&#29992;</strong>
                        </div>
                        <div class="ws-ai-summary-tags">
                            <span class="ws-ai-nav-tag">&#24038;&#20391;&#30446;&#24405;&#20999;&#25442;</span>
                            <span class="ws-ai-nav-tag ws-ai-nav-tag-accent">&#21491;&#20391;&#32534;&#36753;&#21518;&#21333;&#29420;&#20445;&#23384;</span>
                        </div>
                    </div>

                    <div class="ws-ai-workbench-grid">
                        <aside class="ws-ai-panel ws-ai-side-panel ws-ai-side-panel-provider">
                            <div class="ws-ai-panel-head">
                                <div>
                                    <h4>Providers</h4>
                                    <p>&#25509;&#21475;&#20837;&#21475;&#19982;&#23494;&#38053;&#24341;&#29992;</p>
                                </div>
                                <button class="ws-page-btn" id="wsAiNewProviderBtn" type="button">&#26032;&#24314;</button>
                            </div>
                            <div class="ws-ai-side-caption">
                                <span class="ws-ai-side-caption-title">Provider catalog</span>
                                <span class="ws-ai-side-caption-note">&#36873;&#20013;&#24038;&#20391;&#19968;&#39033;&#21518;&#65292;&#21491;&#20391;&#20250;&#20999;&#25442;&#21040;&#23545;&#24212;&#30340;&#32447;&#36335;&#32534;&#36753;&#22120;&#12290;</span>
                            </div>
                            <div class="ws-ai-nav-strip">
                                <span class="ws-ai-nav-tag">&#25509;&#20837;&#30446;&#24405;</span>
                                <span class="ws-ai-nav-tag ws-ai-nav-tag-accent">&#28857;&#20987;&#24038;&#20391;&#26465;&#30446;&#21363;&#21487;&#32534;&#36753;</span>
                            </div>
                            <div class="ws-ai-list-frame">
                                <div class="ws-ai-list" id="wsAiProviderList"></div>
                            </div>
                        </aside>

                        <section class="ws-ai-panel ws-ai-editor-panel ws-ai-editor-panel-provider">
                            <div class="ws-ai-panel-head">
                                <div>
                                    <h4 id="wsAiProviderFormTitle">Provider &#35814;&#24773;</h4>
                                    <p>&#25903;&#25345;&#23448;&#26041; API&#12289;OpenAI-compatible &#20013;&#36716;&#19982;&#33258;&#24314;&#32593;&#20851;</p>
                                </div>
                            </div>
                            <div class="ws-ai-editor-hero">
                                <div class="ws-ai-editor-hero-copy">
                                    <span class="ws-ai-editor-pill">Provider profile</span>
                                    <strong>Endpoint, auth and relay behavior</strong>
                                </div>
                                <span class="ws-ai-editor-note">Edit endpoint, auth reference and runtime flags in one place.</span>
                            </div>
                            <div class="ws-ai-form-stack">
                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Identity</h5>
                                        <p>&#23450;&#20041; provider &#26631;&#35782;&#21644;&#26174;&#31034;&#20449;&#24687;</p>
                                    </div>
                                    <div class="ws-ai-form-grid ws-ai-form-grid-2">
                                        <label class="ws-edit-field">
                                            <span>provider_key</span>
                                            <input id="wsAiProviderKey" type="text" placeholder="openai_relay">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>&#26174;&#31034;&#21517;&#31216;</span>
                                            <input id="wsAiProviderLabel" type="text" placeholder="OpenAI Relay CN">
                                        </label>
                                    </div>
                                </section>

                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Endpoint &amp; Auth</h5>
                                        <p>&#32465;&#23450; Base URL&#12289;request format &#21644; secret &#24341;&#29992;</p>
                                    </div>
                                    <div class="ws-ai-form-grid ws-ai-form-grid-2">
                                        <label class="ws-edit-field ws-edit-field-wide">
                                            <span>Base URL</span>
                                            <input id="wsAiProviderBaseUrl" type="url" placeholder="https://example.com/v1">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>API Path</span>
                                            <input id="wsAiProviderApiPath" type="text" placeholder="/chat/completions">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>auth_type</span>
                                            <input id="wsAiProviderAuthType" type="text" placeholder="bearer">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>secret_key_ref</span>
                                            <select id="wsAiProviderSecretRef"></select>
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>request_format</span>
                                            <input id="wsAiProviderRequestFormat" type="text" placeholder="openai_compatible">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>priority</span>
                                            <input id="wsAiProviderPriority" type="number" step="1" placeholder="100">
                                        </label>
                                    </div>
                                </section>

                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Runtime Flags</h5>
                                        <p>&#25511;&#21046;&#26159;&#21542;&#21551;&#29992;&#12289;&#26159;&#21542;&#20316;&#20026;&#20013;&#36716;&#20197;&#21450;&#38468;&#21152; meta</p>
                                    </div>
                                    <div class="ws-ai-form-grid ws-ai-form-grid-2">
                                        <label class="ws-edit-field">
                                            <span>&#26159;&#21542;&#21551;&#29992;</span>
                                            <select id="wsAiProviderEnabled">
                                                <option value="true">&#21551;&#29992;</option>
                                                <option value="false">&#31105;&#29992;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>&#26159;&#21542;&#20013;&#36716;</span>
                                            <select id="wsAiProviderRelay">
                                                <option value="false">&#21542;</option>
                                                <option value="true">&#26159;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-edit-field-wide">
                                            <span>meta_json</span>
                                            <textarea id="wsAiProviderMeta" rows="3" placeholder='{"region":"cn","owner":"ops"}'></textarea>
                                        </label>
                                    </div>
                                </section>
                            </div>
                            <div class="ws-ai-form-actions">
                                <button class="ws-refresh-btn" id="wsAiSaveProviderBtn" type="button">&#20445;&#23384; Provider</button>
                            </div>
                        </section>
                    </div>

                    <div class="ws-ai-workbench-grid">
                        <aside class="ws-ai-panel ws-ai-side-panel ws-ai-side-panel-route">
                            <div class="ws-ai-panel-head">
                                <div>
                                    <h4>Model Routes</h4>
                                    <p>&#27169;&#22411; ID&#12289;&#19978;&#28216;&#27169;&#22411;&#19982;&#25187;&#36153;&#20493;&#29575;</p>
                                </div>
                                <button class="ws-page-btn" id="wsAiNewRouteBtn" type="button">&#26032;&#24314;</button>
                            </div>
                            <div class="ws-ai-side-caption">
                                <span class="ws-ai-side-caption-title">Route matrix</span>
                                <span class="ws-ai-side-caption-note">&#36825;&#37324;&#20915;&#23450;&#32842;&#22825;&#12289;&#32763;&#35793;&#12289;warmup &#31561;&#33021;&#21147;&#26368;&#32456;&#36208;&#21738;&#26465;&#36335;&#30001;&#12290;</span>
                            </div>
                            <div class="ws-ai-nav-strip">
                                <span class="ws-ai-nav-tag">&#36335;&#30001;&#30446;&#24405;</span>
                                <span class="ws-ai-nav-tag ws-ai-nav-tag-accent">&#31649;&#29702;&#27169;&#22411;&#26174;&#31034;&#19982;&#40664;&#35748;&#36335;&#30001;</span>
                            </div>
                            <div class="ws-ai-list-frame">
                                <div class="ws-ai-list" id="wsAiRouteList"></div>
                            </div>
                        </aside>

                        <section class="ws-ai-panel ws-ai-editor-panel ws-ai-editor-panel-route">
                            <div class="ws-ai-panel-head">
                                <div>
                                    <h4 id="wsAiRouteFormTitle">Route &#35814;&#24773;</h4>
                                    <p>&#20026;&#32842;&#22825;&#12289;&#32763;&#35793;&#12289;warmup &#31561;&#33021;&#21147;&#20998;&#37197;&#19978;&#28216;&#36335;&#30001;</p>
                                </div>
                            </div>
                            <div class="ws-ai-editor-hero">
                                <div class="ws-ai-editor-hero-copy">
                                    <span class="ws-ai-editor-pill">Route profile</span>
                                    <strong>Model identity, upstream and capabilities</strong>
                                </div>
                                <span class="ws-ai-editor-note">Bind model ids to upstream routes and usage capabilities.</span>
                            </div>
                            <div class="ws-ai-form-stack">
                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Identity</h5>
                                        <p>&#35774;&#23450;&#31995;&#32479;&#27169;&#22411; ID&#12289;&#26174;&#31034;&#21517;&#31216;&#21644;&#25551;&#36848;</p>
                                    </div>
                                    <div class="ws-ai-form-grid ws-ai-form-grid-2">
                                        <label class="ws-edit-field">
                                            <span>model_id</span>
                                            <input id="wsAiRouteModelId" type="text" placeholder="gpt-4o-mini">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>&#26174;&#31034;&#21517;&#31216;</span>
                                            <input id="wsAiRouteDisplayName" type="text" placeholder="GPT-4o Mini CN">
                                        </label>
                                        <label class="ws-edit-field ws-edit-field-wide">
                                            <span>&#35828;&#26126;</span>
                                            <input id="wsAiRouteDescription" type="text" placeholder="OpenAI-compatible relay route">
                                        </label>
                                    </div>
                                </section>

                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Routing</h5>
                                        <p>&#32465;&#23450; provider&#12289;&#19978;&#28216;&#27169;&#22411;&#21644;&#25187;&#36153;&#20493;&#29575;</p>
                                    </div>
                                    <div class="ws-ai-form-grid ws-ai-form-grid-3">
                                        <label class="ws-edit-field">
                                            <span>provider_key</span>
                                            <select id="wsAiRouteProviderKey"></select>
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>upstream_model</span>
                                            <input id="wsAiRouteUpstreamModel" type="text" placeholder="gpt-4o-mini">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>price_multiplier</span>
                                            <input id="wsAiRoutePriceMultiplier" type="number" step="0.01" placeholder="1.00">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>sort_order</span>
                                            <input id="wsAiRouteSortOrder" type="number" step="1" placeholder="100">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>icon_type</span>
                                            <input id="wsAiRouteIconType" type="text" placeholder="spark">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>color_class</span>
                                            <input id="wsAiRouteColorClass" type="text" placeholder="text-cyan-500">
                                        </label>
                                        <label class="ws-edit-field">
                                            <span>bg_class</span>
                                            <input id="wsAiRouteBgClass" type="text" placeholder="bg-cyan-500/10">
                                        </label>
                                    </div>
                                </section>

                                <section class="ws-ai-cluster">
                                    <div class="ws-ai-cluster-head">
                                        <h5>Capability Flags</h5>
                                        <p>&#25511;&#21046;&#26174;&#31034;&#29366;&#24577;&#12289;&#40664;&#35748;&#36335;&#30001;&#19982;&#21508;&#21151;&#33021;&#33021;&#21147;&#24320;&#20851;</p>
                                    </div>
                                    <div class="ws-ai-capability-grid">
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#36335;&#30001;&#21551;&#29992;</span>
                                            <small>Route enabled</small>
                                            <select id="wsAiRouteEnabled">
                                                <option value="true">&#21551;&#29992;</option>
                                                <option value="false">&#31105;&#29992;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#21069;&#21488;&#23637;&#31034;</span>
                                            <small>Visible in picker</small>
                                            <select id="wsAiRouteVisible">
                                                <option value="true">&#26174;&#31034;</option>
                                                <option value="false">&#38544;&#34255;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#40664;&#35748;&#27169;&#22411;</span>
                                            <small>Default route</small>
                                            <select id="wsAiRouteDefault">
                                                <option value="false">&#21542;</option>
                                                <option value="true">&#26159;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#32842;&#22825;</span>
                                            <small>supports_chat</small>
                                            <select id="wsAiRouteSupportsChat">
                                                <option value="true">&#26159;</option>
                                                <option value="false">&#21542;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#32763;&#35793;</span>
                                            <small>supports_translate</small>
                                            <select id="wsAiRouteSupportsTranslate">
                                                <option value="false">&#21542;</option>
                                                <option value="true">&#26159;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#39044;&#28909;</span>
                                            <small>supports_warmup</small>
                                            <select id="wsAiRouteSupportsWarmup">
                                                <option value="false">&#21542;</option>
                                                <option value="true">&#26159;</option>
                                            </select>
                                        </label>
                                        <label class="ws-edit-field ws-ai-flag-field">
                                            <span>&#35821;&#38899;</span>
                                            <small>supports_voice</small>
                                            <select id="wsAiRouteSupportsVoice">
                                                <option value="false">&#21542;</option>
                                                <option value="true">&#26159;</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="ws-ai-form-grid">
                                        <label class="ws-edit-field ws-edit-field-wide ws-ai-meta-field">
                                            <span>meta_json</span>
                                            <textarea id="wsAiRouteMeta" rows="3" placeholder='{"family":"gpt","channel":"relay"}'></textarea>
                                        </label>
                                    </div>
                                </section>
                            </div>
                            <div class="ws-ai-form-actions">
                                <button class="ws-refresh-btn" id="wsAiSaveRouteBtn" type="button">&#20445;&#23384; Route</button>
                            </div>
                        </section>
                    </div>

                    <section class="ws-ai-panel ws-ai-secret-panel">
                        <div class="ws-ai-secret-shell">
                            <div class="ws-ai-secret-copy">
                                <div class="ws-ai-panel-head">
                                    <div>
                                        <h4>Secrets</h4>
                                        <p>&#24555;&#36895;&#32500;&#25252; <span class="ws-config-mono">whatsapp.secrets</span> &#20013;&#30340; API Key</p>
                                    </div>
                                </div>
                                <div class="ws-ai-editor-hero ws-ai-editor-hero-compact">
                                    <div class="ws-ai-editor-hero-copy">
                                        <span class="ws-ai-editor-pill">Secret vault</span>
                                        <strong>Only update the referenced key</strong>
                                    </div>
                                    <span class="ws-ai-editor-note">Provider routes read by key name and do not expose the raw secret in the route list.</span>
                                </div>
                            </div>
                            <div class="ws-ai-secret-form">
                                <div class="ws-ai-secret-grid">
                                    <label class="ws-edit-field">
                                        <span>secret key</span>
                                        <input id="wsAiSecretKey" list="wsAiSecretKeys" type="text" placeholder="OPENAI_KEY">
                                        <datalist id="wsAiSecretKeys"></datalist>
                                    </label>
                                    <label class="ws-edit-field ws-edit-field-wide">
                                        <span>secret value</span>
                                        <input id="wsAiSecretValue" type="password" placeholder="sk-...">
                                    </label>
                                    <div class="ws-ai-form-actions ws-ai-secret-actions">
                                        <button class="ws-refresh-btn" id="wsAiSaveSecretBtn" type="button">&#20445;&#23384; Secret</button>
                                    </div>
                                </div>
                                <p class="ws-modal-tip" id="wsAiRoutingStatus">&#20808;&#35835;&#21462;&#24403;&#21069;&#37197;&#32622;&#65292;&#20877;&#25353;&#27169;&#22359;&#20998;&#21035;&#20445;&#23384;&#12290;</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
            <div class="ws-modal-footer">
                <button class="ws-page-btn" id="wsAiRoutingModalRefreshBtn" type="button">&#37325;&#26032;&#35835;&#21462;</button>
                <button class="ws-page-btn" id="wsCancelAiRoutingBtn" type="button">&#20851;&#38381;</button>
            </div>
        </div>
    </div>`;
  }

  window.mountWsAiRoutingWorkspace = function mountWsAiRoutingWorkspace(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = getTemplate();
  };
})();
