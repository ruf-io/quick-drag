var QD_options = (function () {

	//PRIVATE VARIABLES AND FUNCTIONS
	var settings, settings_defaults, createSection, makeChangeListener;

	//DEFAULT OPTIONS (SET IF NO PREVIOUS STORAGE IS FOUND)
	settings_defaults = {
		version:0.1,
		sections:['draggable_elements', 'gestures', 'local', 's3', 'dropbox', 'google_drive', 'tumblr', 'pocket'],
		content:{
			draggable_elements:{
				title:"Draggable Elements",
				options:[
					{id:'A', title:"Links", save:'href', value:true },
					{id:'IMG', title:"Images", save:'src', value:true },
					{id:'#text', title:"Selected Text", save:'text', value:true },
					{id:'VIDEO', title:"Video", save:'src', value:true },
					{id:'AUDIO', title:"Audio", save:'src', value:true }
				]
			},
			gestures:{
				title:'Mouse Gesture',
				options:[
					{id:'up-right', name:'active_gesture', value:true, title:'Drag Up then Right', description:'Drag 50px up and then 50px to the right. The only limitation is for elements at very top of a page.'},
					{id:'right', name:'active_gesture', title:'Drag Right', value:false, description:'Drag 50px to the right. Users who highlight while they read may find this is too easy to trigger unintentionally.'},
					{id:'vertical-right', name:'active_gesture', title:'Drag Vertically then Right', value:false, description:'Drag 50px up OR down, and then 50px to the right.'}
				]
			},
			local:{
				class:'account',
				title:'Save Locally',
				options:[
					{id:'active', value:true, class:'top-right'},
					{id:'directory', title:"Save Directory (relative to chrome default)", value:'', description:'A path, relative to the default Chrome downloads directory, where files will be saved.', required:false},
					{id:'valid_for', title:'Valid For:', value:[1,3,4,], description:"Select content types where this account will appear as an option."}
				]
			},
			s3:{
				class:'account',
				title:'Amazon S3',
				options:[
					{id:'active', value:true, class:'top-right'},
					{id:'access_key', title:"S3 Access Key", value:'', description:'Your Amazon S3 Key.', required:true},
					{id:'secret_key', title:"S3 Secret Key", value:'', description:'Your Amazon S3 SECRET Key (will not exist outside this Chrome Extension.)', required:true},
					{id:'bucket', title:"Bucket Name", value:'', description:'The name of a pre-existing Amazon S3 bucket where your files will be saved.', required:false},
					{id:'valid_for', title:'Valid For:', value:[1,3,4,], description:"Select content types where this account will appear as an option."}
				]
			},
			dropbox:{
				class:'account',
				title:'Dropbox',
				options:[
					{id:'active', value:true, class:'top-right'},
					{id:'folder', title:"Default Dropbox Folder", value:'', description:'The name of a pre-existing Dropbox folder where your files will be saved.', required:false},
					{id:'valid_for', title:'Valid For:', value:[1,3,4,], description:"Select content types where this account will appear as an option."}
				]
			},
			google_drive:{
				class:'account',
				title:'Google Drive',
				options:[
					{id:'active', value:true, class:'top-right'},
					{id:'folder', title:"Folder in Google Drive", value:'', description:'(optional) Folder within Google Drive where items will be saved', required:false},
					{id:'valid_for', title:'Valid For:', value:[0,1,2,3,4], description:"Select content types where this account will appear as an option."}
				]
			},
			tumblr:{
				class:'account',
				title:'Tumblr',
				options:[
					{id:'active', value:false, class:'top-right'},
					{id:'valid_for', title:'Valid For:', value:[0,1,2,3,4], description:"Select content types where this account will appear as an option."}
				]
			},
			pocket:{
				class:'account',
				title:'Pocket',
				options:[
					{id:'active', value:false, class:'top-right'},
					{id:'code', value:'', class:'hidden'},
					{id:'username', value:'', class:'hidden'},
					{id:'access_token', value:'', class:'hidden'},
					{id:'valid_for', title:'Valid For:', value:[0,1,2,3,4], description:"Select content types where this account will appear as an option."}
				]
			}
		}
	};

	makeChangeListener = function(obj, group) {
		return function(event) {
			//SPECIAL CASE FOR RADIO
			if(group && event.target.checked) {
				for(var opt of group) {
					if('name' in opt && opt.name === obj.name) opt.value = false;
				}
			}
			switch(event.target.type) {
				case "select-multiple":
					var set = event.target.children, setlen = set.length, i;
					obj.value = [];
					for(i=0; i<setlen; i++) {
						if (set[i].selected) {
							console.log("Adding: " + set[i].text + " id: " + set[i].value);
							obj.value.push(parseInt(set[i].value, 10));
						}
					}
					console.log(obj.value);
					break;
				case 'text':
					obj.value = event.target.value;
					break;
				default:
					obj.value = event.target.checked;
					break;
			}
			chrome.storage.sync.set(settings, function(){});
		}
	};

	//CREATE OPTIONS SECTION FROM DATA OBJECT
	//	-REQUIRES BAREBONES HTML IN OPTIONS PAGE WITH "template" CLASS
	createSection = function(sec_id, sec_data) {
		var sec = document.querySelector('section.template').cloneNode(true);
		if(sec) {
			sec.classList.remove('template');
			if('class' in sec_data) sec.classList.add(sec_data.class);
			if('title' in sec_data) {
				var h3 = sec.querySelector('h3');
				h3.innerText = sec_data.title;
				if ('description' in sec_data) h3.title = sec_data.description;
			}
			if('options' in sec_data && sec_data.options instanceof Array) {
				for(var field of sec_data.options) {
					var wrapper = sec.querySelector('label.template').cloneNode(true),
						input = wrapper.querySelector('input'),
						label = wrapper.querySelector('span');
					wrapper.classList.remove('template');
					if('class' in field) wrapper.classList.add(field.class);
					if('required' in field && field.required) wrapper.classList.add('required');
					if('value' in field) {
						switch(typeof(field.value)) {
							case "boolean":
								input.type = "checkbox";
								input.checked = field.value;
								break;
							case "object": //MULTI-SELECT
								wrapper.removeChild(input);
								input = document.createElement('select');
								wrapper.appendChild(input);
								input.setAttribute('multiple', 'multiple');
								var t_des = settings.content.draggable_elements.options, t_des_len = t_des.length, i, t_de, t_de_sel;
								for(i=0; i<t_des_len; i++) {
									t_de = t_des[i];
									if(t_de.value) {
										var opt = document.createElement('option');
										opt.value = i;
										opt.innerText = t_de.title;
										t_de_sel = false;
										for(var key of field.value) {
											if (key === i) {t_de_sel = true; break;}
										}
										opt.selected = t_de_sel
										input.appendChild(opt);
									}
								}
								
								break;
							default:
								input.type = "text";
								input.value = field.value;
								break;
						}
						if('name' in field) {
							input.name = field.name;
							input.type = 'radio';
						}
					}
					if('title' in field) {
						label.innerText = field.title;
						//ADD "HALF" CLASS TO SHORTER LABELS TO ALLOW CSS TO TREAT DIFFERENTLY
						if (field.title.length < 25) wrapper.classList.add('half');
						//SWTICH THE ORDER FOR TEXT FIELDS TO MAKE LABEL FIRST
						if (input.type === "text") wrapper.insertBefore(label, input);
					}
					//OPTIONALLY ADD DESCRIPTION TOOLTIP
					if('description' in field) wrapper.title = field.description;
					input.addEventListener('change', makeChangeListener(field, (input.type === "radio" ? sec_data.options : null)));
					sec.appendChild(wrapper);
				}
			}
		}
		return sec;
	};
 
	return {
		// A public function utilizing privates
		init: function() {
			chrome.storage.sync.get(settings_defaults, function(stored_settings) {
				settings = stored_settings;
				document.querySelector('#rendered_form').innerHTML = "";
				for(var section_name of stored_settings.sections) {
					if(section_name in stored_settings.content) {						
						document.querySelector('#rendered_form').appendChild(createSection(section_name, stored_settings.content[section_name]));
					}
				}
				//EXTRA INTERACTION CUSTOMIZATION
				//DEFAULT INACTIVE ACCOUNTS TO UNEXPANDED
				var accounts = document.querySelectorAll('section.account');
				[].forEach.call(accounts, function(account) {
					if(!account.querySelector('.top-right input').checked) account.classList.add('inactive');
				});
				//LISTENER TO HIDE AND EXPAND ACCOUNTS BASED ON CHECKBOX
				document.addEventListener('click', function(event) {
					if(event.target.parentElement.className.indexOf('top-right') > -1) {
						if(event.target.checked) event.target.parentElement.parentElement.classList.remove('inactive');
						else event.target.parentElement.parentElement.classList.add('inactive');
					}
				});
				chrome.storage.sync.set(settings, function(){});
			});
    	},
    	reset: function() {
    		chrome.storage.sync.set(settings_defaults, function(){console.log('fini')})
    	},
    	get: function(callback) {
    		if(callback) {
    		} else if(settings) {
    			return getSimpleSettings();
    		}
    	}
	};
 
})();

QD_options.init();