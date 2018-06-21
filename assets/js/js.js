///////// GLOBAL VARIABLES /////////
	var community     = 'bet-steem';
	var quinielasPost = 'quinielas-russia-2018-betsteem'
	var strings       = {
		countries: {
			"Russia":"ru","Saudi Arabia":"sa","Egypt":"eg","Uruguay":"uy","Morocco":"ma","Iran":"ir","Portugal":"pt","Spain":"es","France":"fr","Australia":"au","Argentina":"ar","Iceland":"is","Peru":"pe","Denmark":"dk","Croatia":"hr","Nigeria":"ng","Costa Rica":"cr","Germany":"de","Mexico":"mx","Brazil":"br","Switzerland":"ch","Sweden":"se","South Korea":"kr","Belgium":"be","Panama":"pa","Tunisia":"tn","England":"gb","Colombia":"co","Japan":"jp","Poland":"pl","Senegal":"sn", "Serbia": "rs"
		},
		months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		buttons: {
			login: 'Login',
			wait: '<i class="fas fa-spinner fa-spin"></i>'
		}
	}
///////// GLOBAL FUNCTIONS /////////
	// GLOBAL
		//Avoid closing the login dropdown by clicking inside it
			$(document).on('click', '.logindropdown', function (e) {
			  e.stopPropagation();
			});

		// Encode & decode content
			function encodeContent(_content){
				if(typeof(_content) === 'object'){
					_content = JSON.stringify(_content);
				}
				var $encoded = encodeURIComponent(_content);//Encode it like 'Esta es una canción' => 'esta%20es%20una%20canci%C3%B3n'
				var $btoa = btoa($encoded);//Convert the encoded content into base64
				return $btoa;
			}
			function decodeContent(_content){
				var $atob = atob(_content);//Decode base 64 content into like 'esta%20es%20una%20canci%C3%B3n'
				var $decoded = decodeURIComponent($atob)//Decode the previous content into 'Esta es una canción'
				try {
				  $decoded = JSON.parse($decoded);//If $decoded can be parsed is an object so needs to be parsed
				}
				catch (exception) {//Else do nothing, it's a string and it's good as is
					//
				}
				return $decoded
			}

		//Save a vaule into session or local storage
			function cacheVar(_key, _val, _remember){
				var val      = typeof(_val) === 'object' ? JSON.stringify(_val) : _val;
				var btoa     = encodeContent(val);//Content must be encoded to save in local storage
				var $storage = _remember ? localStorage : sessionStorage;//If remember true save local else session
				
				delete $storage[_key];//in case the key already exists delete it, we'll save a updated version

				try{
					$storage[_key] = btoa;//If there is space in the storage save it
				}catch(exception){//If there's no space, first delete the first item in storage, then try again
					var deletePosition = Object.keys($storage)[0] === 'steemgit' ? 1 : 0;
					delete $storage[Object.keys($storage)[deletePosition]];
					cacheVar(_key, _val, _remember)
				}
			}

		//Convert date
			function convertDate(_date, _format){
				var time    = _date.split("T")[1];
				_date    		= _date.substr(0, _date.lastIndexOf("T"));
				var year    = _date.substr(0, _date.indexOf("-"));
				var month   = strings.months[parseInt(_date.split('-')[1]) - 1];
				var day     = _date.split('-')[2];
				if(_format === 'closing'){
					return 'Voting closes on ' + month + ', ' + day + ' at ' + time + ' GMT';
				}else if(_format === 'starts'){
					return month + ', ' + day + ' at ' + time + ' GMT';
				}
			}

		//On voteQuiniela modal hide
			function hideVoteModal(){
				$('#voteQuiniela').modal('hide');
			}
			$(document).on('hidden.bs.modal', '#voteQuiniela', function (e) {
			  $('#voteQuiniela .modal-title').empty();
			  $('#voteQuiniela .publishing').removeClass('d-none');
			  $('#voteQuiniela .close, #voteQuiniela .wait, #voteQuiniela .success, #voteQuiniela .publish-post, #voteQuiniela .published').addClass('d-none');
			})
	//STEEM
		function getSteemUser(user, repeated){
			return new Promise(resolve => {
				steem.api.getAccounts([user], function(err, users){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get steemit user)\n' + err)
							hideVoteModal()
						}else{
							getSteemUser(user, true)
						}
					}else{
						resolve(users[0])
					}
				})
			})
		}

		async function getCurrentVoteValue(user, weight){
			var $user = await getSteemUser(user);
			return new Promise(async resolve => {
				var received_vesting_shares           = parseFloat($user.received_vesting_shares.replace(" VESTS", ""))
				var vesting_shares                    = parseFloat($user.vesting_shares.replace(" VESTS", ""))
				var delegated_vesting_shares          = parseFloat($user.delegated_vesting_shares.replace(" VESTS", ""))
				var effective_vesting_shares          = vesting_shares - delegated_vesting_shares + received_vesting_shares
				var secondsago                        = (new Date - new Date($user.last_vote_time + "Z")) / 1000
				var voting_power                      = $user.voting_power + (10000 * secondsago / 432000)
				voting_power                          = (Math.min(voting_power / 100, 100).toFixed(2))*100;
				var STEEMIT_VOTE_REGENERATION_SECONDS = 5 * 60 * 60 * 24; // it takes 5 days to regenerate 100% voting power
				var STEEMIT_100_PERCENT               = 10000;
				var current_voting_power              = voting_power;
				var vote_pct_weight                   = weight;
				var fund                              = await getRewardFund();
				var pot                               = parseFloat(fund.reward_balance.replace(" STEEM", ""));
				var total_r2                          = parseInt(fund.recent_claims, 10);
				var weighted_power                    = (current_voting_power * vote_pct_weight) / STEEMIT_100_PERCENT;
				var voting_power_used                 = weighted_power/50
				var rshares                           = Math.floor(((effective_vesting_shares * voting_power_used)/10000)*1000000);
				var _steem                            = 0;
				var contrib                           = rshares * pot / total_r2
				_steem                                += contrib;
				var feed                              = await getFeedHistory();
				var sbdBase                           = feed.current_median_history.base.replace(' SBD', '');
				var sbd                               = _steem * sbdBase;
				var voting                            = {
					power  : voting_power,
					weight : weight,
					vests  : effective_vesting_shares,
					shares : rshares,
					sbd    : sbd,
					secondsago: secondsago
				}
				console.log(voting)
				resolve(voting );
			})
		}

		async function getCastedVoteValue(par){
			return new Promise(async resolve => {
				var fund = par.fund ? par.fund : await getRewardFund();
				var feed = par.feed ? par.feed : await getFeedHistory();
				var total_r2 = parseInt(fund.recent_claims, 10)
				var pot = fund.reward_balance.replace(' STEEM', '');
				var _steem = par.rshares * pot / total_r2;
				var sbdBase = feed.current_median_history.base.replace(' SBD', '');
				var sbd = _steem * sbdBase;
				resolve(sbd)
			})
		}

		function getRewardFund(repeated){
			return new Promise(resolve => {
				steem.api.getRewardFund("post", function(err,reward_fund){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get reward fund)\n' + err)
							hideVoteModal()
						}else{
							getRewardFund(true)
						}
					}else{
						resolve(reward_fund);
					}
				})
			})
		}

		function getFeedHistory(repeated){
			return new Promise(resolve => {
				steem.api.getFeedHistory(function(err, feed_history){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get feed history)\n' + err)
							hideVoteModal()
						}else{
							getRewardFund(true)
						}
					}else{
						resolve(feed_history);
					}
				})
			})
		}

		function castVote(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.vote(
	    		par.wif, 
	    		par.voter,
	    		par.author,
	    		par.permlink, 
	    		par.weight, 
	    		async function(err, vote){
	    			console.log(err, vote)
	    			if(err){
	    				if(repeated){
	    					if(par.author !== community){
	    						var deletePost = await deleteComment(par);
	    					}
		    				if(err.message === "Assert Exception:info->abs_rshares > STEEM_VOTE_DUST_THRESHOLD || vote_weight == 0: Voting weight is too small, please accumulate more voting power or steem power."){
		    					alert('You have not enough voting power');
		    					hideVoteModal()
		    				}else{
		    					alert('Ooops something went wrong (cast vote)\n' + err)
		    					hideVoteModal()
		    				}
	    				}else{
	    					castVote(par, true)
	    				}
	    			}else{
	    				console.log(vote);
	    				resolve(vote);
	    			}
	    		}
	    	)
    	})
		}

		function deleteComment(par){
			return new Promise(resolve => {
				steem.broadcast.deleteComment(par.wif, par.author, par.permlink, function(err, result){
					resolve(result)
				})
			})
		}

		function getPost(par){
			return new Promise(resolve => {
				steem.api.getContent(par.author, par.permlink, async function(err, post) {
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get post)\n' + err)
							hideVoteModal()
						}else{
							getPost(par, true);
						}
					}else{
						if(post.children > 0){
							post.replies = await fetchreplies(post)
						}
						resolve(post)
					}
				});
			})
		}

		function fetchreplies(post, nested){
			return new Promise(resolve => {
				steem.api.getContentReplies(post.author, post.permlink, async function(err, comments) {
					resolve(comments)
				})
			})
		}

		function getActiveVotes(post){
			return new Promise(resolve => {
				steem.api.getActiveVotes(post.author, post.permlink, function(err, votes) {
				  resolve(votes)
				});
			})
		}

		function postComment(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.comment (
				  par.private_posting_wif,  // Steemit.com Wallet -> Permissions -> Show Private Key (for Posting)
				  par.parent_author,        // empty for new blog post - also empty for editing an existing post
				  par.parent_permlink,      // main tag for new blog post - for post editing it's the parent_permalink parameter from original post
				  par.author,               // same user the private_posting_key is for
				  par.permlink,             // a slug (lowercase 'a'-'z', '0'-'9', and '-', min 1 character, max 255 characters) - permalink from original for editing
				  par.title,                // human-readable title - title fron original for editing
				  par.body,                 // body of the post or comment
				  par.json_metadata,        // arbitrary metadata
				  async function(err, comment){
				  	if(err){
				  		if(repeated){
				  			alert('Ooops something went wrong (post comment)\n' + err)
				  			hideVoteModal()
				  		}else{
				  			postComment(par, true)
				  		}
				  	}else{
				  		if(par.beneficiaries){
				  			var options = await commentOptions(par);
				  			resolve({comment: comment, options: options})
				  		}else{
				  			resolve({comment: comment})
				  		}
				  	}
				  }
				)
			});
		}

		function commentOptions(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.commentOptions(
	        par.private_posting_wif,
	        par.author, //author
	        par.permlink, //permalink
	        '1000000.000 SBD', //max accepted payout
	        10000, //Percent steem dollars is the option that determines what percentages you want your rewards in, with 10000 meaning 50/50 as usual, and 0 meaning 100% power up.
	        par.allowVotes, //allowVotes
	        par.allowCuration, //allowCurationRewards
	        [
	        	[
	        		0, 
	        		{
	          		"beneficiaries": par.beneficiaries
	        		}
	        	]
	        ],
	        function (err, options) {
	          if(err){
	          	if(repeated){
				  			alert('Ooops something went wrong (comment options)\n' + err)
				  			hideVoteModal()
				  		}else{
				  			commentOptions(par, true)
				  		}
	          }else{
	          	resolve(options)
	          }
	        }
	      );
			})
		}

		function estimateVote(weight){
			steem.api.getRewardFund("post", function(err,reward_fund){
				var recent_claims = parseInt(reward_fund.recent_claims);
				var reward_balance = parseFloat(reward_fund.reward_balance.replace(" STEEM", ""))
				steem.api.getAccounts(['ar2ro'], function(err, users){
					var user                     = users[0];
					var vesting_shares           = parseFloat(user.vesting_shares.replace(" VESTS", ""))
					var received_vesting_shares  = parseFloat(user.received_vesting_shares.replace(" VESTS", ""))
					var delegated_vesting_shares = parseFloat(user.delegated_vesting_shares.replace(" VESTS", ""))
					var total_vests              = vesting_shares + received_vesting_shares - delegated_vesting_shares;
					var final_vest               = total_vests * 1e6;
					var secondsago               = (new Date - new Date(user.last_vote_time + "Z")) / 1000
					//var voting_power             = user.voting_power + (10000 * secondsago / 432000)
					var voting_power = user.voting_power;
					weight                       = weight * 100
					var power                    = (voting_power * weight / 10000) / 50
					var rshares                  = power * final_vest / 10000
					steem.api.getFeedHistory(function(err, feed_history){
						var sbd_median_price = parseFloat(feed_history.current_median_history.base.replace(" VESTS", ""))
						
						//////////////// Calculate /////////////////
						var estimate = rshares / recent_claims * reward_balance * sbd_median_price
						console.log(rshares, estimate)
					})
				})
			})
		}

///////// VUE /////////
window.app = new Vue({
	el: '#app',
	delimiters: ["{[","]}"],
	data: {
		steem: {name: null, avatar: null, wif: null, voting: null},
		errors: {wif: false, mismatch: false, notFound: false, steemit: false},
		quinielas : {items: null, votes: {}}
	},
	methods: {
		steemLogin: async function(event){
			var user;
			var userName = this.$refs.username.value;
			var wif      = this.$refs.wif.value;
			var remember = this.$refs.remember.checked;
			this.errors  = {wif: false, mismatch: false, notFound: false};

			if(wif.length !== 51 || !wif.startsWith('5')){
				this.errors.wif = true;
			}else{
				event.target.innerHTML = strings.buttons.wait;
				var $user = await getSteemUser(userName);//get user
				if($user.err){
					this.errors.steemit = err;
				}else {
					if($user.name){
						var pubWif = $user.posting.key_auths[0][0];//Get the public wif wich will be compared with the private one
						try{ isvalid = steem.auth.wifIsValid(wif, pubWif); }//compare public vs private
						//The verification returns true or false if a valid private key is passed but if you change a character and make the private invalid it doesn't return true or false but an error so we use a catch function to set the isvalid to false
						catch(e){ isvalid = false; }
						if(isvalid == true){
							var userData = {
								name: $user.name,
								avatar: 'https://img.busy.org/@' + $user.name + '?size=20',
								wif: wif
							}
							cacheVar('steem', userData, remember);//storage it on browser storage
							this.$refs.username.value = this.$refs.wif.value = '';
							event.target.innerHTML = strings.buttons.login;
							userData.voting = await getCurrentVoteValue(userData.name, 10000);
							this.$set(this, 'steem', userData);
						}else{
							event.target.innerHTML = strings.buttons.login;//reactivate the button
							this.errors.mismatch = true;//show password mismatch error
						}
					}else{
						event.target.innerHTML = strings.buttons.login;
						this.errors.notFound   = true;//show no user found error
					}
				}
			}
		},
		getFlag(name){
			var url = 'https://lipis.github.io/flag-icon-css/flags/4x3/'
			url += strings.countries[name];
			url += '.svg'
			return url;
		},
		convertDate(_date, _format){

			return convertDate(_date, _format);
		},
		voteQuiniela: async function(quiniela){
			//Show modal
			$('#voteQuiniela').modal('show');
			$('#voteQuiniela .modal-title').text('Registering your quiniela');
			$('#voteQuiniela .wait').removeClass('d-none');

			var selectedVoteValue = parseInt(this.$refs['voteValue' + quiniela][0].value);
			var castedVoteValue;
			//Get current voting value, current_voting_power may have changed since last time calculated
			var currentVoteValue  = await getCurrentVoteValue(this.steem.name, 10000);
			//this is the needed weight to produce a vote with the selected value.
			var voteWeight = 10000 * selectedVoteValue /currentVoteValue.sbd
			//voteWeight may be higher than 100% (10000). Example a vote at 100% weight is 0.0016, if I try to get the weight needed vor a 1.00 vote I get a weight higher than 100% so if it's higger than 100 make  it 100
			voteWeight = voteWeight > 10000 ? 10000 : voteWeight;
			var quiniela = this.quinielas.items[quiniela];
			var tBody = '';
			$.each(quiniela.matches, function(i,v){
				delete v.starts
				tBody += '<tr><td>' + Object.keys(v)[0] + '</td>'
				tBody += '<td align="center">' + Object.values(v)[0] + '</td>'
				tBody += '<td align="center">vs</td>'
				tBody += '<td align="center">' + Object.values(v)[1] + '</td>'
				tBody += '<td align="right">' + Object.keys(v)[1] + '</td></tr>'
			})
			this.$refs.tBody.innerHTML = tBody;
			var replyPermlink = steem.formatter.commentPermlink(community, quinielasPost);
			var reply_meta = {
				community : 'betsteem', 
				app       : 'betsteem/1.0.0', 
				tags      : ['betsteem', 'quiniela', 'world-cup', 'betting', 'steemdev'], 
				links     : ['http://betsteem.com/quinielas'],
				format    : 'html',
				quiniela  : quiniela,
				vote      : currentVoteValue
			}
			var comment = await postComment({//Create a comment with the selection data
				private_posting_wif: this.steem.wif,  
			  parent_author: community,
			  parent_permlink: quinielasPost,
			  author: this.steem.name,
			  permlink: replyPermlink,
			  title: 'quiniela' + this.$refs.postTitle.id,//change for some data in the vote response
			  body: this.$refs.qTable.innerHTML,
			  json_metadata: JSON.stringify(reply_meta),
			})
			var options = await commentOptions({
				private_posting_wif: this.steem.wif,
        author:this.steem.name, 
        permlink:replyPermlink, 
        allowVotes:true, 
        allowCuration:false, 
        beneficiaries: [{account: community, weight: 10000}]
			})
			var vote = await castVote({//Vote on that comment
				wif: this.steem.wif,
    		voter: this.steem.name,
    		author: this.steem.name,
    		permlink: replyPermlink, 
    		weight: voteWeight
			})

			this.$refs.postTitle.id = vote.id;
			$('#voteQuiniela .wait').addClass('d-none');
			$('#voteQuiniela .success').removeClass('d-none');
		},
		postQuiniela: async function(){
			$('#voteQuiniela .modal-title').text('Publishing your post');
			$('#voteQuiniela .success').addClass('d-none')
			$('#voteQuiniela .publish-post').removeClass('d-none')

			var meta = {
				community : 'betsteem', 
			  app       : 'betsteem/1.0.0', 
			  tags      : ['betsteem', 'quiniela', 'world-cup', 'betting', 'steemdev'], 
			  links			: ['http://betsteem.com/quinielas'],
			  format    : 'html',
			}
			var comment = await postComment({
				private_posting_wif : this.steem.wif,
				parent_author       : '',
				parent_permlink     : 'betsteem',
				author              : this.steem.name,
				permlink            : 'quiniela-' + this.$refs.postTitle.id,
				title               : this.$refs.postTitle.innerText,
				body                : this.$refs.postContent.innerHTML,
				json_metadata       : JSON.stringify(meta)
			})
			$('#voteQuiniela .publish-post .publihing').addClass('d-none')
			$('#voteQuiniela .publish-post .published, #voteQuiniela .close').removeClass('d-none')
		},
		getJackpot(array){
			var totals = [0, 0]
			$.each(array, function (i,v){
				totals[0] ++;
				totals[1] += v;
			})
			return totals
		}
	},
	created: async function(){
		if(localStorage['steem'] || sessionStorage['steem']){
			try{//We don't know if user stored on local or session so try first with local then with session
				this.steem = decodeContent(localStorage['steem']);
			}catch(exception){
				this.steem = decodeContent(sessionStorage['steem']);
			}
			var voting = await getCurrentVoteValue(this.steem.name, 10000);
			this.$set(this.steem, 'voting', voting)
		}
		if($('#quinielas').length > 0){//if page is quinielas
			//Get the post containing the quinielas and save the quinielas data
			var post = await getPost({author:community, permlink:quinielasPost, nested: false});
			this.$set(this.quinielas, 'items', JSON.parse(post.json_metadata).quinielas);
			$('body').removeClass('loading');
			//Create the object that will contain the votes divided by ammount
			for(i=0; i<Object.keys(this.quinielas.items).length; i++){
				var quiniela = this.quinielas.items[i]
				var name     = quiniela.name;
				this.$set(this.quinielas.votes, name, {1: [], 3: [], 5: [], 10: [], 15: [], 20: []})
			}

			//Get fund and feed in order to calculate vote value from rshares
			var fund   = await getRewardFund();
			var feed   = await getFeedHistory();

			//Get every reply and extract the rshares generated by the vote, then store it in the "casted" object inside the corresponding object, example: "casted['Round 2']"
			var casted = {};
			
			for(i=0; i<post.replies.length; i++){
				var reply   = post.replies[i];
				var meta    = JSON.parse(reply.json_metadata);
				var name    = meta.quiniela.name;
				var rshares = meta.vote.shares;
				if(name in casted){
				}else{
					casted[name] = []
				}
				var sbd = await getCastedVoteValue({
					fund: fund,
					feed: feed,
					rshares: rshares
				})
				casted[name].push(parseFloat(sbd.toFixed(4)));
			}
			//Get every value inside the "casted" object and determine if the value is closest to 1,3,5,10,15 or 20 to store it in the corresponding array.
			for(key in casted){
				var quiniela = casted[key];
				
				for(i=0; i<quiniela.length; i++){
					var value = quiniela[i];
					if(value > 0){
						if(Math.floor(value) in this.quinielas.votes[key]){
							this.quinielas.votes[key][Math.floor(value)].push(value);
						}else if(Math.ceil(value) in this.quinielas.votes[key]){
							this.quinielas.votes[key][Math.ceil(value)].push(value);
						}else{
							var diff = [];
							for(Key in this.quinielas.votes[key]){
								var dif = value - Key;
								dif = dif < 0 ? -dif : dif;
								diff.push(dif)
							}
							var min = Math.min(...diff)
							this.quinielas.votes[key][Object.keys(this.quinielas.votes[key])[diff.indexOf(min)]].push(value)
						}
					}
				}
			}
		}
	}
})